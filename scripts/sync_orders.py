#!/usr/bin/env python3
"""
Fast Metabase -> Supabase orders sync using direct PostgreSQL batch upserts.

Much faster than the JS REST upsert loop (~79 sequential HTTP calls for 79k rows).
Uses execute_values with 5k-10k row pages; optional parallel workers.

Usage:
  python scripts/sync_orders.py
  python scripts/sync_orders.py --job-id <uuid>
  python scripts/sync_orders.py --batch-size 10000 --workers 4

Requires in .env.local (or GitHub Actions secrets):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_DB_PASSWORD   - Database password only (easiest; auto-builds IPv4 pooler URL)
  DATABASE_URL           - Optional full Postgres URI (session pooler preferred over direct db.* host)
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse, urlunparse

import requests

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    psycopg2 = None
    execute_values = None

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_METABASE_URL = (
    "https://zambeel.metabaseapp.com/public/question/"
    "96450ced-a27c-47c9-b9cd-58fe804a7889.json"
)

DEFAULT_RATES_TO_USD: dict[str, float] = {
    "USD": 1.0,
    "KWD": 3.27,
    "AED": 0.272294,
    "SAR": 0.266667,
    "QAR": 0.274725,
    "OMR": 2.597403,
    "BHD": 2.65252,
    "PKR": 0.00359,
    "IQD": 0.00076,
}

COUNTRY_CURRENCY: dict[str, str] = {
    "Kuwait": "KWD",
    "KWT": "KWD",
    "United Arab Emirates": "AED",
    "UAE": "AED",
    "Saudi Arabia": "SAR",
    "KSA": "SAR",
    "Qatar": "QAR",
    "QTR": "QAR",
    "QA": "QAR",
    "Oman": "OMR",
    "OMN": "OMR",
    "Bahrain": "BHD",
    "BHR": "BHD",
    "Pakistan": "PKR",
    "PAK": "PKR",
    "Karachi": "PKR",
    "Iraq": "IQD",
    "IRQ": "IQD",
}

COLUMNS = [
    "order_id",
    "order_number",
    "domain",
    "store_id",
    "store_url",
    "country",
    "city",
    "full_name",
    "title",
    "sku",
    "quantity",
    "total_payable",
    "currency",
    "status",
    "substatus",
    "tag",
    "bifurcation",
    "delivery_partner",
    "platform",
    "order_date",
    "approved_date",
    "shipment_date",
    "shipment_date_log",
    "delivered_date",
    "returned_date",
    "undelivered_date",
    "final_action_date_undelivered",
    "resolved_payable",
    "payable_estimated",
    "usd_revenue",
    "account_manager_key",
    "order_date_day",
    "synced_at",
]

UPSERT_SQL = f"""
INSERT INTO ops_orders_items ({", ".join(COLUMNS)})
VALUES %s
ON CONFLICT (order_id, sku) DO UPDATE SET
  order_number = EXCLUDED.order_number,
  domain = EXCLUDED.domain,
  store_id = EXCLUDED.store_id,
  store_url = EXCLUDED.store_url,
  country = EXCLUDED.country,
  city = EXCLUDED.city,
  full_name = EXCLUDED.full_name,
  title = EXCLUDED.title,
  quantity = EXCLUDED.quantity,
  total_payable = EXCLUDED.total_payable,
  currency = EXCLUDED.currency,
  status = EXCLUDED.status,
  substatus = EXCLUDED.substatus,
  tag = EXCLUDED.tag,
  bifurcation = EXCLUDED.bifurcation,
  delivery_partner = EXCLUDED.delivery_partner,
  platform = EXCLUDED.platform,
  order_date = EXCLUDED.order_date,
  approved_date = EXCLUDED.approved_date,
  shipment_date = EXCLUDED.shipment_date,
  shipment_date_log = EXCLUDED.shipment_date_log,
  delivered_date = EXCLUDED.delivered_date,
  returned_date = EXCLUDED.returned_date,
  undelivered_date = EXCLUDED.undelivered_date,
  final_action_date_undelivered = EXCLUDED.final_action_date_undelivered,
  resolved_payable = EXCLUDED.resolved_payable,
  payable_estimated = EXCLUDED.payable_estimated,
  usd_revenue = EXCLUDED.usd_revenue,
  account_manager_key = EXCLUDED.account_manager_key,
  order_date_day = EXCLUDED.order_date_day,
  synced_at = EXCLUDED.synced_at
"""


def load_env() -> None:
    env_path = ROOT / ".env.local"
    if load_dotenv and env_path.exists():
        load_dotenv(env_path, override=True)
    elif env_path.exists():
        for line in env_path.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            os.environ[key] = val


def env_value(*keys: str) -> str | None:
    """First non-empty env var. Empty strings count as unset (GitHub Actions quirk)."""
    for key in keys:
        raw = os.environ.get(key)
        if raw is None:
            continue
        val = raw.strip()
        if val:
            return val
    return None


def metabase_orders_url() -> str:
    explicit = env_value("METABASE_ORDERS_API_URL", "METABASE_OPERATIONS_ORDERS_URL")
    if explicit:
        return explicit
    return DEFAULT_METABASE_URL


def supabase_url() -> str | None:
    url = env_value("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL")
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        url = f"https://{url.lstrip('/')}"
    return url.rstrip("/")


def supabase_service_key() -> str | None:
    return env_value("SUPABASE_SERVICE_ROLE_KEY")


def validate_sync_env(use_rest: bool) -> None:
    metabase = metabase_orders_url()
    if not metabase.startswith(("http://", "https://")):
        raise RuntimeError(
            "Metabase orders URL is missing or invalid. "
            "Set METABASE_ORDERS_API_URL or remove an empty GitHub secret so the default URL is used."
        )

    if use_rest and (not supabase_url() or not supabase_service_key()):
        raise RuntimeError(
            "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for REST sync. "
            "URL must include https:// (e.g. https://xxxx.supabase.co)."
        )


def parse_date(raw: Any) -> datetime | None:
    if not raw:
        return None
    try:
        s = str(raw).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def account_manager_key(row: dict[str, Any]) -> str:
    domain = str(row.get("domain") or "").strip()
    if domain:
        return domain
    store_url = str(row.get("store_url") or "").strip()
    if store_url:
        return store_url
    store_id = row.get("store_id")
    if store_id:
        return f"Store {store_id}"
    return "Unknown"


def normalize_title(raw: str) -> str:
    t = (raw or "").strip()
    return t or "No title"


def normalize_country(raw: str) -> str:
    c = (raw or "").strip()
    return c or "Unknown"


def title_country_key(title: str, country: str) -> str:
    return f"{normalize_title(title)}\0{normalize_country(country)}"


def currency_from_sku(sku: str) -> str | None:
    if sku.endswith("-KWT") or "-KWT-" in sku:
        return "KWD"
    if sku.endswith("-KSA") or "-KSA-" in sku:
        return "SAR"
    if sku.endswith("-QTR") or "-QTR-" in sku:
        return "QAR"
    if sku.endswith("-OMN") or "-OMN-" in sku:
        return "OMR"
    if sku.endswith("-BHR") or "-BHR-" in sku:
        return "BHD"
    if sku.endswith("-PAK") or "-PAK-" in sku:
        return "PKR"
    if sku.endswith("-IRQ") or "-IRQ-" in sku:
        return "IQD"
    if sku.endswith("-ZAM") and not any(x in sku for x in ("-KWT", "-KSA", "-QTR", "-OMN", "-BHR", "-PAK", "-IRQ")):
        return "AED"
    return None


def get_rates_to_usd() -> dict[str, float]:
    rates = dict(DEFAULT_RATES_TO_USD)
    raw = os.environ.get("EXCHANGE_RATES_TO_USD_JSON")
    if raw:
        try:
            rates.update(json.loads(raw))
        except json.JSONDecodeError:
            pass
    return rates


def get_currency_for_country(country: str, sku: str = "") -> str:
    normalized = (country or "").strip()
    if normalized in COUNTRY_CURRENCY:
        return COUNTRY_CURRENCY[normalized]
    lower = normalized.lower()
    for key, code in COUNTRY_CURRENCY.items():
        if key.lower() == lower:
            return code
    from_sku = currency_from_sku(sku)
    if from_sku:
        return from_sku
    return "USD"


def convert_to_usd(amount: float, country: str, sku: str = "", currency_override: str | None = None) -> float:
    if not amount:
        return 0.0
    rates = get_rates_to_usd()
    if currency_override:
        code = currency_override.upper()
        return amount * rates.get(code, 1.0)
    currency = get_currency_for_country(country, sku)
    return amount * rates.get(currency, 1.0)


def normalize_rows(raw: list[Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for r_ in raw:
        if not isinstance(r_, dict):
            continue
        r = r_
        order_date = parse_date(r.get("Order_date"))
        rows.append(
            {
                "order_id": int(r.get("id") or 0),
                "order_number": str(r.get("order_number") or ""),
                "domain": str(r.get("domain") or ""),
                "store_id": int(r.get("store_id") or 0),
                "store_url": str(r.get("store_url") or ""),
                "country": str(r.get("country") or ""),
                "city": str(r.get("city") or ""),
                "full_name": str(r.get("full_name") or ""),
                "title": str(r.get("title") or ""),
                "sku": str(r.get("sku") or ""),
                "quantity": int(r.get("quantity") or 1),
                "total_payable": float(r.get("total_payable") or 0),
                "currency": str(r.get("currency") or ""),
                "status": str(r.get("status") or ""),
                "substatus": str(r.get("substatus") or ""),
                "tag": str(r.get("tag") or ""),
                "bifurcation": str(r.get("bifurcation") or ""),
                "delivery_partner": str(r.get("delivery_partner") or ""),
                "platform": str(r.get("platform") or r.get("PLATFORM") or ""),
                "order_date": order_date,
                "approved_date": parse_date(r.get("approved_date")),
                "shipment_date": parse_date(r.get("shipment_date")),
                "shipment_date_log": parse_date(r.get("shipment_date_log")),
                "delivered_date": parse_date(r.get("delivered_date")),
                "returned_date": parse_date(r.get("Returned_date")),
                "undelivered_date": parse_date(r.get("Undelivered_date")),
                "final_action_date_undelivered": parse_date(
                    r.get("Final_action_date_undelivered")
                ),
            }
        )
    return rows


def apply_revenue_imputation(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Chronological imputation — mirrors src/lib/analytics/revenue-imputation.ts."""
    with_dates = [r for r in rows if r.get("order_date")]
    sorted_rows = sorted(
        with_dates,
        key=lambda r: (
            r["order_date"],
            r.get("order_id") or 0,
            r.get("sku") or "",
        ),
    )

    last_unit: dict[str, float] = {}
    resolved: dict[str, tuple[float, bool]] = {}

    for row in sorted_rows:
        key = title_country_key(row.get("title", ""), row.get("country", ""))
        line_key = f"{row.get('order_id')}:{row.get('sku')}"
        qty = max(int(row.get("quantity") or 1), 1)
        payable = float(row.get("total_payable") or 0)

        if payable > 0:
            last_unit[key] = payable / qty
            resolved[line_key] = (payable, False)
            continue

        unit = last_unit.get(key)
        if unit is not None:
            resolved[line_key] = (unit * qty, True)
        else:
            resolved[line_key] = (0.0, False)

    enriched: list[dict[str, Any]] = []
    for row in rows:
        line_key = f"{row.get('order_id')}:{row.get('sku')}"
        if line_key in resolved:
            rp, est = resolved[line_key]
        else:
            payable = float(row.get("total_payable") or 0)
            rp, est = (payable if payable > 0 else 0.0, False)

        currency = str(row.get("currency") or "").strip() or None
        usd = convert_to_usd(rp, row.get("country", ""), row.get("sku", ""), currency)
        order_date = row.get("order_date")
        order_date_day = order_date.date().isoformat() if order_date else None

        enriched.append(
            {
                **row,
                "resolved_payable": rp,
                "payable_estimated": est,
                "usd_revenue": usd,
                "account_manager_key": account_manager_key(row),
                "order_date_day": order_date_day,
            }
        )
    return enriched


def row_to_tuple(row: dict[str, Any], synced_at: datetime) -> tuple[Any, ...]:
    return (
        row.get("order_id") or None,
        row.get("order_number") or "",
        row.get("domain") or "",
        row.get("store_id") or None,
        row.get("store_url") or "",
        row.get("country") or "",
        row.get("city") or "",
        row.get("full_name") or "",
        row.get("title") or "",
        row.get("sku") or "",
        int(row.get("quantity") or 1),
        float(row.get("total_payable") or 0),
        row.get("currency") or "",
        row.get("status") or "",
        row.get("substatus") or "",
        row.get("tag") or "",
        row.get("bifurcation") or "",
        row.get("delivery_partner") or "",
        row.get("platform") or "",
        row.get("order_date"),
        row.get("approved_date"),
        row.get("shipment_date"),
        row.get("shipment_date_log"),
        row.get("delivered_date"),
        row.get("returned_date"),
        row.get("undelivered_date"),
        row.get("final_action_date_undelivered"),
        float(row.get("resolved_payable") or 0),
        bool(row.get("payable_estimated")),
        float(row.get("usd_revenue") or 0),
        row.get("account_manager_key") or "Unknown",
        row.get("order_date_day"),
        synced_at,
    )


def _metabase_error_detail(resp: requests.Response) -> str:
    try:
        body = resp.json()
        if isinstance(body, dict):
            err = body.get("error") or body.get("message")
            err_type = body.get("error_type")
            if err:
                return f"{err_type}: {err}" if err_type else str(err)
    except (ValueError, json.JSONDecodeError):
        pass
    snippet = (resp.text or "").strip()
    return snippet[:240] if snippet else f"HTTP {resp.status_code}"


def _is_retryable_metabase_failure(status: int, detail: str) -> bool:
    lowered = detail.lower()
    if status in (429, 502, 503, 504):
        return True
    if status == 400 and (
        "invalid-query" in lowered
        or "error occurred while running the query" in lowered
        or "timeout" in lowered
    ):
        return True
    return False


def fetch_metabase(url: str, max_attempts: int = 6) -> list[Any]:
    print("Fetching Metabase data...", flush=True)
    t0 = time.perf_counter()
    last_err: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            if attempt > 1:
                wait = min(30 * (2 ** (attempt - 2)), 180)
                print(f"  Retry {attempt}/{max_attempts} after {wait}s...", flush=True)
                time.sleep(wait)
            # connect 60s, read up to 20 min (large Metabase exports can be slow)
            resp = requests.get(url, timeout=(60, 1200))
            detail = _metabase_error_detail(resp)

            if not resp.ok:
                if _is_retryable_metabase_failure(resp.status_code, detail):
                    raise requests.HTTPError(
                        f"{resp.status_code} Client Error: {detail} for url: {resp.url}",
                        response=resp,
                    )
                resp.raise_for_status()

            data = resp.json()
            if isinstance(data, dict) and data.get("status") == "failed":
                detail = _metabase_error_detail(resp)
                if _is_retryable_metabase_failure(400, detail):
                    raise ValueError(f"Metabase query failed: {detail}")
                raise ValueError(f"Metabase query failed: {detail}")

            if not isinstance(data, list):
                raise ValueError(f"Metabase response is not a JSON array: {detail}")

            print(f"  -> {len(data):,} rows in {time.perf_counter() - t0:.1f}s", flush=True)
            return data
        except (requests.RequestException, ValueError) as exc:
            last_err = exc
            print(f"  Fetch attempt {attempt} failed: {exc}", flush=True)

    raise RuntimeError(f"Metabase fetch failed after {max_attempts} attempts: {last_err}")


def normalize_pg_url(url: str) -> str:
    """Percent-encode password so special chars ($, @, etc.) work in the URI."""
    parsed = urlparse(url)
    if not parsed.hostname or not parsed.username:
        return url
    password = parsed.password or ""
    if password and any(c in password for c in "$#&+,:;=?@[]"):
        password = quote(password, safe="")
    host = parsed.hostname
    if parsed.port:
        host = f"{host}:{parsed.port}"
    netloc = f"{parsed.username}:{password}@{host}"
    return urlunparse(
        (
            parsed.scheme,
            netloc,
            parsed.path,
            parsed.params,
            parsed.query,
            parsed.fragment,
        )
    )


# Supabase shared pooler regions (IPv4-safe for GitHub Actions; auto-probed when password-only).
POOLER_AWS_REGIONS = (
    "ap-south-1",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-northeast-1",
    "ap-northeast-2",
    "eu-west-1",
    "eu-west-2",
    "eu-west-3",
    "eu-central-1",
    "eu-central-2",
    "eu-north-1",
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
    "ca-central-1",
    "sa-east-1",
    "af-south-1",
    "me-south-1",
)

_resolved_database_url: str | None = None


def supabase_project_ref() -> str:
    url = supabase_url()
    if not url:
        raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL is required.")
    host = urlparse(url).hostname or ""
    if host.endswith(".supabase.co"):
        ref = host.split(".", 1)[0]
        if ref:
            return ref
    raise RuntimeError(
        "Could not parse Supabase project ref from NEXT_PUBLIC_SUPABASE_URL. "
        "Expected https://xxxx.supabase.co"
    )


def has_postgres_config() -> bool:
    return bool(
        env_value("DATABASE_URL", "SUPABASE_DB_URL", "SUPABASE_DB_PASSWORD")
    )


def build_pooler_url(project_ref: str, password: str, pooler_host: str, port: int = 5432) -> str:
    encoded_password = quote(password, safe="")
    return (
        f"postgresql://postgres.{project_ref}:{encoded_password}"
        f"@{pooler_host}:{port}/postgres?sslmode=require"
    )


def _ensure_sslmode(url: str) -> str:
    raw = normalize_pg_url(url)
    if "sslmode=" not in raw:
        raw += "&sslmode=require" if "?" in raw else "?sslmode=require"
    return raw


def _probe_postgres(url: str, timeout: int = 8) -> bool:
    if psycopg2 is None:
        return False
    try:
        conn = psycopg2.connect(url, connect_timeout=timeout)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        finally:
            conn.close()
        return True
    except Exception:
        return False


def resolve_database_url() -> str:
    """Resolve a working Supabase Postgres URI (prefers IPv4 session pooler)."""
    global _resolved_database_url
    if _resolved_database_url:
        return _resolved_database_url

    raw = env_value("DATABASE_URL", "SUPABASE_DB_URL") or ""
    password = env_value("SUPABASE_DB_PASSWORD") or ""
    region_hint = env_value("SUPABASE_DB_REGION") or ""

    if raw:
        parsed = urlparse(raw)
        if parsed.password and not password:
            password = parsed.password

    if raw and "pooler.supabase.com" in raw:
        _resolved_database_url = _ensure_sslmode(raw)
        return _resolved_database_url

    if raw and ("db." in raw and ".supabase.co" in raw):
        print(
            "  NOTE: Direct db.*.supabase.co URLs use IPv6 and fail on GitHub Actions. "
            "Using Supabase session pooler instead.",
            flush=True,
        )

    if not password:
        raise RuntimeError(
            "Postgres connection requires SUPABASE_DB_PASSWORD. "
            "In Supabase: Project Settings → Database → Database password. "
            "Add it as GitHub secret SUPABASE_DB_PASSWORD (password only, no URL)."
        )

    project_ref = supabase_project_ref()
    pooler_hosts: list[str] = []
    if region_hint:
        pooler_hosts.append(f"aws-0-{region_hint}.pooler.supabase.com")
        pooler_hosts.append(f"aws-{region_hint}.pooler.supabase.com")
    for region in POOLER_AWS_REGIONS:
        pooler_hosts.append(f"aws-0-{region}.pooler.supabase.com")

    seen: set[str] = set()
    for host in pooler_hosts:
        if host in seen:
            continue
        seen.add(host)
        candidate = build_pooler_url(project_ref, password, host)
        if _probe_postgres(candidate):
            print(f"  Postgres via Supabase pooler ({host})", flush=True)
            _resolved_database_url = candidate
            return candidate

    raise RuntimeError(
        "Could not connect to Supabase Postgres via session pooler. "
        "Check SUPABASE_DB_PASSWORD. Optional: set SUPABASE_DB_REGION "
        "(e.g. ap-south-1) from Supabase → Connect → Session pooler."
    )


def get_database_url() -> str:
    return resolve_database_url()


def pg_connect():
    if psycopg2 is None:
        raise RuntimeError("psycopg2 not installed. Run: pip install -r scripts/requirements-sync.txt")
    return psycopg2.connect(get_database_url(), connect_timeout=30)


def _copy_cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def upsert_postgres_copy(rows: list[dict[str, Any]], synced_at: datetime) -> None:
    """Fastest path: COPY into temp table, then one bulk INSERT ON CONFLICT."""
    tuples = [row_to_tuple(r, synced_at) for r in rows]
    total = len(tuples)
    print(f"Postgres COPY upsert for {total:,} rows...", flush=True)
    t0 = time.perf_counter()

    staging_cols = ", ".join(COLUMNS)
    staging_ddl = f"""
    CREATE TEMP TABLE ops_orders_staging (
      {", ".join(f"{c} TEXT" for c in COLUMNS)}
    ) ON COMMIT DROP
    """

    set_cols = [c for c in COLUMNS if c not in ("order_id", "sku")]
    update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in set_cols)

    merge_sql = f"""
    INSERT INTO ops_orders_items ({staging_cols})
    SELECT
      NULLIF(order_id, '')::BIGINT,
      order_number,
      domain,
      NULLIF(store_id, '')::BIGINT,
      store_url,
      country,
      city,
      full_name,
      title,
      sku,
      NULLIF(quantity, '')::INTEGER,
      NULLIF(total_payable, '')::NUMERIC,
      currency,
      status,
      substatus,
      tag,
      bifurcation,
      delivery_partner,
      platform,
      NULLIF(order_date, '')::TIMESTAMPTZ,
      NULLIF(approved_date, '')::TIMESTAMPTZ,
      NULLIF(shipment_date, '')::TIMESTAMPTZ,
      NULLIF(shipment_date_log, '')::TIMESTAMPTZ,
      NULLIF(delivered_date, '')::TIMESTAMPTZ,
      NULLIF(returned_date, '')::TIMESTAMPTZ,
      NULLIF(undelivered_date, '')::TIMESTAMPTZ,
      NULLIF(final_action_date_undelivered, '')::TIMESTAMPTZ,
      NULLIF(resolved_payable, '')::NUMERIC,
      CASE WHEN payable_estimated IN ('true', 't', '1') THEN TRUE ELSE FALSE END,
      NULLIF(usd_revenue, '')::NUMERIC,
      account_manager_key,
      NULLIF(order_date_day, '')::DATE,
      NULLIF(synced_at, '')::TIMESTAMPTZ
    FROM ops_orders_staging
    ON CONFLICT (order_id, sku) DO UPDATE SET {update_set}
    """

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    for row in tuples:
        writer.writerow([_copy_cell(v) for v in row])
    buf.seek(0)

    conn = pg_connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL synchronous_commit TO OFF")
            cur.execute(staging_ddl)
            cur.copy_expert(
                f"COPY ops_orders_staging ({staging_cols}) FROM STDIN WITH (FORMAT csv)",
                buf,
            )
            cur.execute(merge_sql)
        conn.commit()
    finally:
        conn.close()

    print(f"  OK COPY upsert in {time.perf_counter() - t0:.1f}s", flush=True)


def upsert_batch_pg(conn, tuples: list[tuple[Any, ...]], page_size: int) -> None:
    with conn.cursor() as cur:
        execute_values(cur, UPSERT_SQL, tuples, page_size=page_size)


def upsert_postgres(
    rows: list[dict[str, Any]],
    synced_at: datetime,
    batch_size: int,
    workers: int,
) -> None:
    tuples = [row_to_tuple(r, synced_at) for r in rows]
    total = len(tuples)
    chunks = [tuples[i : i + batch_size] for i in range(0, total, batch_size)]
    print(
        f"Upserting {total:,} rows in {len(chunks)} batch(es), "
        f"batch_size={batch_size:,}, workers={workers}...",
        flush=True,
    )
    t0 = time.perf_counter()

    if workers <= 1 or len(chunks) <= 1:
        conn = pg_connect()
        try:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL synchronous_commit TO OFF")
                for i, chunk in enumerate(chunks, 1):
                    execute_values(cur, UPSERT_SQL, chunk, page_size=min(batch_size, len(chunk)))
                    if i % 5 == 0 or i == len(chunks):
                        done = min(i * batch_size, total)
                        print(f"  ... {done:,} / {total:,} rows", flush=True)
            conn.commit()
        finally:
            conn.close()
    else:
        db_url = get_database_url()

        def worker(chunk: list[tuple[Any, ...]]) -> int:
            conn = psycopg2.connect(db_url, connect_timeout=30)
            try:
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL synchronous_commit TO OFF")
                    execute_values(cur, UPSERT_SQL, chunk, page_size=min(batch_size, len(chunk)))
                conn.commit()
                return len(chunk)
            finally:
                conn.close()

        done = 0
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(worker, chunk) for chunk in chunks]
            for fut in as_completed(futures):
                done += fut.result()
                if done % (batch_size * 5) < batch_size or done == total:
                    print(f"  ... {done:,} / {total:,} rows", flush=True)

    print(f"  OK Upsert complete in {time.perf_counter() - t0:.1f}s", flush=True)


def upsert_rest(rows: list[dict[str, Any]], synced_at: datetime, batch_size: int, workers: int) -> None:
    """Fallback: Supabase REST upsert with concurrent batches."""
    url = supabase_url()
    key = supabase_service_key()
    if not url or not key:
        raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for REST fallback")

    synced_iso = synced_at.isoformat()
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    endpoint = f"{url}/rest/v1/ops_orders_items?on_conflict=order_id,sku"

    def payload(row: dict[str, Any]) -> dict[str, Any]:
        return {
            "order_id": row.get("order_id"),
            "order_number": row.get("order_number"),
            "domain": row.get("domain"),
            "store_id": row.get("store_id"),
            "store_url": row.get("store_url"),
            "country": row.get("country"),
            "city": row.get("city"),
            "full_name": row.get("full_name"),
            "title": row.get("title"),
            "sku": row.get("sku"),
            "quantity": row.get("quantity"),
            "total_payable": row.get("total_payable"),
            "currency": row.get("currency"),
            "status": row.get("status"),
            "substatus": row.get("substatus"),
            "tag": row.get("tag"),
            "bifurcation": row.get("bifurcation"),
            "delivery_partner": row.get("delivery_partner"),
            "platform": row.get("platform"),
            "order_date": row["order_date"].isoformat() if row.get("order_date") else None,
            "approved_date": row["approved_date"].isoformat() if row.get("approved_date") else None,
            "shipment_date": row["shipment_date"].isoformat() if row.get("shipment_date") else None,
            "shipment_date_log": row["shipment_date_log"].isoformat() if row.get("shipment_date_log") else None,
            "delivered_date": row["delivered_date"].isoformat() if row.get("delivered_date") else None,
            "returned_date": row["returned_date"].isoformat() if row.get("returned_date") else None,
            "undelivered_date": row["undelivered_date"].isoformat() if row.get("undelivered_date") else None,
            "final_action_date_undelivered": (
                row["final_action_date_undelivered"].isoformat()
                if row.get("final_action_date_undelivered")
                else None
            ),
            "resolved_payable": row.get("resolved_payable"),
            "payable_estimated": row.get("payable_estimated"),
            "usd_revenue": row.get("usd_revenue"),
            "account_manager_key": row.get("account_manager_key"),
            "order_date_day": row.get("order_date_day"),
            "synced_at": synced_iso,
        }

    batches = [rows[i : i + batch_size] for i in range(0, len(rows), batch_size)]
    print(f"REST upsert {len(rows):,} rows in {len(batches)} batches (workers={workers})...", flush=True)
    t0 = time.perf_counter()

    def send_batch(batch: list[dict[str, Any]]) -> int:
        body = [payload(r) for r in batch]
        last_err: Exception | None = None
        for attempt in range(1, 4):
            try:
                r = requests.post(endpoint, headers=headers, json=body, timeout=120)
                if not r.ok:
                    raise RuntimeError(f"REST upsert failed ({r.status_code}): {r.text[:500]}")
                return len(batch)
            except Exception as exc:
                last_err = exc
                if attempt < 3:
                    time.sleep(3 * attempt)
        raise last_err if last_err else RuntimeError("REST upsert failed")

    done = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(send_batch, b) for b in batches]
        for fut in as_completed(futures):
            done += fut.result()
            print(f"  ... {done:,} / {len(rows):,}", flush=True)

    print(f"  OK REST upsert in {time.perf_counter() - t0:.1f}s", flush=True)


def delete_stale(synced_at: datetime) -> None:
    try:
        conn = pg_connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM ops_orders_items WHERE synced_at < %s",
                    (synced_at,),
                )
            conn.commit()
        finally:
            conn.close()
        return
    except Exception:
        pass

    url = supabase_url()
    key = supabase_service_key()
    if not url or not key:
        return
    endpoint = f"{url}/rest/v1/ops_orders_items"
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    requests.delete(
        endpoint,
        headers=headers,
        params={"synced_at": f"lt.{synced_at.isoformat()}"},
        timeout=120,
    )


def log_sync(row_count: int, status: str, error: str | None = None) -> None:
    try:
        conn = pg_connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ops_sync_log (source, row_count, status, error_message)
                    VALUES ('orders', %s, %s, %s)
                    """,
                    (row_count, status, error),
                )
            conn.commit()
        finally:
            conn.close()
        return
    except Exception:
        pass

    url = supabase_url()
    key = supabase_service_key()
    if url and key:
        try:
            requests.post(
                f"{url}/rest/v1/ops_sync_log",
                headers={
                    "apikey": key,
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json=[{"source": "orders", "row_count": row_count, "status": status, "error_message": error}],
                timeout=30,
            )
        except Exception as exc:
            print(f"  WARN sync log write failed: {exc}", flush=True)


def queue_mv_refresh_via_rest() -> bool:
    """Queue MV refresh inside Supabase (fast REST call; pg_cron processes within ~1 min)."""
    url = supabase_url()
    key = supabase_service_key()
    if not url or not key:
        return False
    try:
        resp = requests.post(
            f"{url}/rest/v1/rpc/queue_ops_mv_refresh",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=30,
        )
        if resp.ok:
            print(
                "  Materialized views refresh queued in Supabase (runs within ~1 min via pg_cron).",
                flush=True,
            )
            return True
        if resp.status_code == 404:
            print(
                "  WARN queue_ops_mv_refresh not found — run patch_ops_mv_refresh_queue.sql in Supabase.",
                flush=True,
            )
            return False
        print(
            f"  ERROR MV refresh queue failed ({resp.status_code}): {resp.text[:300]}",
            flush=True,
        )
        return False
    except Exception as exc:
        print(f"  ERROR MV refresh queue failed: {exc}", flush=True)
        return False


def refresh_summaries() -> bool:
    """Refresh order materialized views. Returns True on success or successful queue."""
    try:
        conn = pg_connect()
        try:
            with conn.cursor() as cur:
                cur.execute("SET statement_timeout = '600s'")
                cur.execute("SELECT refresh_ops_orders_summaries_simple()")
            conn.commit()
            print("  Materialized views refreshed.", flush=True)
            return True
        except Exception as exc:
            print(f"  ERROR MV refresh failed (data saved): {exc}", flush=True)
            return False
        finally:
            conn.close()
    except Exception as pg_err:
        print(f"  WARN Postgres refresh unavailable ({pg_err}); trying REST...", flush=True)

    url = supabase_url()
    key = supabase_service_key()
    if url and key:
        try:
            resp = requests.post(
                f"{url}/rest/v1/rpc/refresh_ops_orders_summaries_simple",
                headers={"apikey": key, "Authorization": f"Bearer {key}"},
                timeout=600,
            )
            if resp.ok:
                print("  Materialized views refreshed (REST).", flush=True)
                return True
            print(
                f"  WARN MV refresh REST failed ({resp.status_code}): {resp.text[:300]}",
                flush=True,
            )
        except Exception as exc:
            print(f"  WARN MV refresh REST failed: {exc}", flush=True)

        return queue_mv_refresh_via_rest()

    print("  ERROR MV refresh skipped: no Postgres or Supabase credentials.", flush=True)
    return False


def update_job(job_id: str, **fields: Any) -> None:
    if not job_id:
        return
    sets = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [job_id]

    try:
        conn = pg_connect()
        try:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE ops_sync_jobs SET {sets} WHERE id = %s", values)
            conn.commit()
        finally:
            conn.close()
        return
    except Exception:
        pass

    url = supabase_url()
    key = supabase_service_key()
    if url and key:
        try:
            requests.patch(
                f"{url}/rest/v1/ops_sync_jobs",
                headers={
                    "apikey": key,
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                params={"id": f"eq.{job_id}"},
                json=fields,
                timeout=30,
            )
        except Exception as exc:
            print(f"  WARN job update failed: {exc}", flush=True)


def run_sync(
    job_id: str | None = None,
    batch_size: int = 10000,
    workers: int = 6,
    use_rest: bool = False,
) -> dict[str, Any]:
    load_env()
    validate_sync_env(use_rest)
    metabase_url = metabase_orders_url()
    synced_at = datetime.now(timezone.utc)
    t_total = time.perf_counter()

    try:
        if job_id:
            update_job(job_id, status="running", error_message="Fetching data from Metabase...")

        print(f"Metabase URL: {metabase_url}", flush=True)
        raw = fetch_metabase(metabase_url)
        rows = normalize_rows(raw)

        if job_id:
            update_job(job_id, error_message="Enriching order rows...")

        enriched = apply_revenue_imputation(rows)
        total = len(enriched)
        print(f"Enriched {total:,} rows", flush=True)

        if job_id:
            update_job(
                job_id,
                error_message=f"Upserting {total:,} rows (batch={batch_size}, workers={workers})...",
            )

        has_pg = has_postgres_config()
        if use_rest or not has_pg:
            upsert_rest(enriched, synced_at, batch_size, workers)
        else:
            try:
                if total >= 1000:
                    upsert_postgres_copy(enriched, synced_at)
                else:
                    upsert_postgres(enriched, synced_at, batch_size, workers)
            except Exception as pg_exc:
                print(
                    f"Postgres upsert failed ({pg_exc}). Falling back to parallel REST...",
                    flush=True,
                )
                rest_batch = min(2000, batch_size)
                rest_workers = min(3, workers)
                upsert_rest(enriched, synced_at, rest_batch, rest_workers)

        if job_id:
            update_job(job_id, error_message="Removing stale rows...")
        delete_stale(synced_at)

        if job_id:
            update_job(job_id, error_message="Refreshing materialized views...")
        if not refresh_summaries():
            raise RuntimeError(
                "Orders synced but materialized view refresh failed. "
                "Run patch_fix_refresh_summaries.sql and patch_ops_mv_refresh_queue.sql in Supabase."
            )

        log_sync(total, "success")

        elapsed = time.perf_counter() - t_total
        print(f"\nOK Synced {total:,} rows in {elapsed:.1f}s ({total / max(elapsed, 0.1):,.0f} rows/s)", flush=True)

        if job_id:
            update_job(
                job_id,
                status="success",
                finished_at=datetime.now(timezone.utc).isoformat(),
                row_count=total,
                error_message=None,
            )

        return {"ok": True, "rowCount": total, "elapsedSeconds": round(elapsed, 2)}

    except Exception as exc:
        msg = str(exc)
        print(f"\nFAILED Sync failed: {msg}", file=sys.stderr, flush=True)
        log_sync(0, "failed", msg)
        if job_id:
            update_job(
                job_id,
                status="failed",
                finished_at=datetime.now(timezone.utc).isoformat(),
                row_count=0,
                error_message=msg,
            )
        return {"ok": False, "rowCount": 0, "error": msg}


def main() -> int:
    parser = argparse.ArgumentParser(description="Fast Metabase -> Supabase orders sync")
    parser.add_argument("--job-id", help="ops_sync_jobs UUID for portal progress tracking")
    parser.add_argument("--batch-size", type=int, default=10000, help="Rows per upsert batch (default 10000)")
    parser.add_argument("--workers", type=int, default=6, help="Parallel upsert workers (default 6)")
    parser.add_argument("--rest", action="store_true", help="Force Supabase REST instead of Postgres")
    args = parser.parse_args()

    result = run_sync(
        job_id=args.job_id,
        batch_size=args.batch_size,
        workers=args.workers,
        use_rest=args.rest,
    )

    # Final line for Node.js spawn parser
    print(json.dumps(result), flush=True)
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
