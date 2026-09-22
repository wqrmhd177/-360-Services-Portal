"""Sync Ticketing Raw Data (mapped columns only) into ops_ticket_facts.

Column map:
  D Final Ticket Date, E Ticket_ID, I Category, J Sub_Category,
  K Current_Status, Q Ticket_Direction,
  Y Minutes_To_First_Staff_Reply, AB Hours_To_Resolution.
No PII is stored.
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sync_orders import supabase_service_key, supabase_url  # noqa: E402

SHEET_ID = "1u9gqhrSUveX7Z3-3O8Dw9KlAbiIV9b_9ZImw0j2TDHk"
SELECT_COLS = "D,E,I,J,K,Q,Y,AB"
UA = {"User-Agent": "Mozilla/5.0 (compatible; 360-portal-ticketing-sync/1.0)"}
CTX = ssl.create_default_context()
MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def load_env() -> None:
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ[key.strip()] = val.strip().strip('"').strip("'")


def parse_date(raw: str) -> date | None:
    val = raw.strip()
    if not val:
        return None
    m = re.fullmatch(r"(\d{1,2})[-\s]+([A-Za-z]{3})[-\s]+(\d{2,4})", val)
    if m:
        day = int(m.group(1))
        month = MONTHS.get(m.group(2).lower())
        year = int(m.group(3))
        if year < 100:
            year += 2000
        if month:
            try:
                return date(year, month, day)
            except ValueError:
                return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d", "%d %b %Y"):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    if val.replace(".", "", 1).isdigit():
        try:
            serial = float(val)
            if serial > 20000:
                return date(1899, 12, 30) + timedelta(days=int(serial))
        except ValueError:
            return None
    return None


def parse_metric(raw: str) -> float | None:
    val = raw.strip().replace(",", "")
    if not val:
        return None
    try:
        n = float(val)
    except ValueError:
        return None
    if n < 0:
        return None
    return n


def parse_direction(raw: str) -> str | None:
    val = raw.strip().lower()
    if val == "inbound":
        return "Inbound"
    if val == "outbound":
        return "Outbound"
    return None


def header_index(headers: list[str], *names: str) -> int | None:
    lower = [h.strip().lower().replace("_", " ") for h in headers]
    for name in names:
        needle = name.strip().lower().replace("_", " ")
        if needle in lower:
            return lower.index(needle)
    for i, h in enumerate(lower):
        for name in names:
            needle = name.strip().lower().replace("_", " ")
            if needle and needle in h:
                return i
    return None


def fetch_raw_csv() -> str:
    tq = urllib.parse.quote(f"select {SELECT_COLS}")
    sheet = urllib.parse.quote("Raw Data")
    url = (
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq"
        f"?tqx=out:csv&sheet={sheet}&tq={tq}"
    )
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, context=CTX, timeout=180) as resp:
        text = resp.read().decode("utf-8", "replace")
        final = resp.geturl()
    if "accounts.google.com" in final or text.lstrip().startswith("<!"):
        raise RuntimeError(
            "Ticketing Raw Data is not readable. Share the sheet with the sync "
            "service account, or keep the Raw Data tab reachable for backend sync."
        )
    return text


def parse_facts(text: str) -> list[dict]:
    reader = csv.reader(io.StringIO(text))
    try:
        headers = next(reader)
    except StopIteration:
        return []

    i_id = header_index(headers, "ticket id", "ticket_id")
    i_date = header_index(headers, "final ticket date", "ticket date")
    i_cat = header_index(headers, "category")
    i_sub = header_index(headers, "sub category", "sub_category")
    i_status = header_index(headers, "current status", "status")
    i_dir = header_index(headers, "ticket direction", "direction")
    i_reply = header_index(headers, "minutes to first staff reply")
    i_hours = header_index(headers, "hours to resolution")

    if i_id is None or i_date is None:
        raise RuntimeError(f"Missing mapped headers in Raw Data: {headers}")

    by_id: dict[str, dict] = {}
    skipped = 0
    for row in reader:
        def cell(idx: int | None) -> str:
            if idx is None or idx >= len(row):
                return ""
            return row[idx].strip()

        ticket_id = cell(i_id)
        if not ticket_id:
            skipped += 1
            continue
        by_id[ticket_id] = {
            "ticket_id": ticket_id,
            "ticket_date": parse_date(cell(i_date)),
            "direction": parse_direction(cell(i_dir)),
            "category": cell(i_cat) or None,
            "sub_category": cell(i_sub) or None,
            "status": cell(i_status) or None,
            "first_reply_minutes": parse_metric(cell(i_reply)),
            "resolution_hours": parse_metric(cell(i_hours)),
        }
    print(f"  parsed {len(by_id)} unique tickets, skipped {skipped} without id", flush=True)
    return list(by_id.values())


def iso(value: date | datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def rest_headers() -> dict[str, str]:
    url = supabase_url()
    key = supabase_service_key()
    if not url or not key:
        raise RuntimeError(
            "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for REST sync"
        )
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }


def rest_request(
    path: str,
    method: str,
    body: bytes | None = None,
    extra: dict[str, str] | None = None,
) -> bytes:
    url = supabase_url()
    req = urllib.request.Request(
        f"{url}{path}",
        data=body,
        method=method,
        headers={**rest_headers(), **(extra or {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read()[:500].decode("utf-8", "replace")
        if exc.code == 404 and "ops_ticket_facts" in detail:
            raise RuntimeError(
                "ops_ticket_facts does not exist yet. Run setup_ops_ticketing.sql "
                "in the Supabase SQL editor, then sync again."
            ) from exc
        raise RuntimeError(f"REST {method} {path} failed ({exc.code}): {detail}") from exc


def fact_payload(row: dict, synced_at: str) -> dict:
    return {
        "ticket_id": row["ticket_id"],
        "ticket_date": iso(row["ticket_date"]),
        "direction": row["direction"],
        "category": row["category"],
        "sub_category": row["sub_category"],
        "status": row["status"],
        "first_reply_minutes": row["first_reply_minutes"],
        "resolution_hours": row["resolution_hours"],
        "synced_at": synced_at,
    }


def apply_sql_if_possible() -> None:
    sql_path = ROOT / "setup_ops_ticketing.sql"
    if not sql_path.exists():
        return
    try:
        import psycopg2  # type: ignore
    except ImportError:
        print("  psycopg2 not installed; skip SQL apply (REST upsert still runs)", flush=True)
        return

    from urllib.parse import quote, urlparse

    raw = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL") or ""
    password = os.environ.get("SUPABASE_DB_PASSWORD") or ""
    if raw:
        parsed = urlparse(raw)
        if parsed.password and not password:
            password = parsed.password
    supabase = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or ""
    host = urlparse(supabase).hostname or ""
    project_ref = host.split(".", 1)[0] if host.endswith(".supabase.co") else ""
    if not password or not project_ref:
        print("  SQL apply skipped: no Postgres password / project ref", flush=True)
        return

    candidates = []
    if raw:
        candidates.append(("DATABASE_URL", raw))
    for pooler_host in (
        "aws-0-ap-south-1.pooler.supabase.com",
        "aws-0-me-central-1.pooler.supabase.com",
        "aws-0-eu-central-1.pooler.supabase.com",
        "aws-0-us-east-1.pooler.supabase.com",
    ):
        candidates.append((
            pooler_host,
            (
                f"postgresql://postgres.{project_ref}:{quote(password, safe='')}"
                f"@{pooler_host}:5432/postgres?sslmode=require"
            ),
        ))

    sql = sql_path.read_text(encoding="utf-8")
    for label, url in candidates:
        try:
            conn = psycopg2.connect(url, connect_timeout=8)
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.close()
            print(f"  applied setup_ops_ticketing.sql via {label}", flush=True)
            return
        except Exception:
            continue
    print("  SQL apply skipped: Postgres not reachable from this machine", flush=True)


def upsert_facts_rest(rows: list[dict]) -> int:
    synced_at = datetime.now(timezone.utc).isoformat()
    print("  clearing previous ticketing facts via REST…", flush=True)
    rest_request("/rest/v1/ops_ticket_facts?synced_at=gte.1970-01-01", "DELETE")

    batch = 500
    total = len(rows)
    i = 0
    while i < total:
        chunk = [fact_payload(row, synced_at) for row in rows[i : i + batch]]
        rest_request(
            "/rest/v1/ops_ticket_facts?on_conflict=ticket_id",
            "POST",
            json.dumps(chunk).encode("utf-8"),
        )
        i += batch
        done = min(i, total)
        if done == total or done % 2000 == 0:
            print(f"  … {done:,} / {total:,} tickets", flush=True)

    try:
        rest_request(
            "/rest/v1/ops_sync_log",
            "POST",
            json.dumps(
                [{"source": "ticketing", "row_count": total, "status": "success"}]
            ).encode("utf-8"),
        )
    except Exception as exc:
        print(f"  WARN sync log write failed: {exc}", flush=True)
    return total


def main() -> None:
    load_env()
    print("Applying ticketing SQL if database is reachable…", flush=True)
    apply_sql_if_possible()
    print("Fetching Ticketing Raw Data (mapped columns only)…", flush=True)
    text = fetch_raw_csv()
    print(f"  csv bytes={len(text.encode('utf-8'))}", flush=True)
    rows = parse_facts(text)

    inbound = sum(1 for row in rows if row.get("direction") == "Inbound")
    outbound = sum(1 for row in rows if row.get("direction") == "Outbound")
    print(f"  inbound={inbound:,} outbound={outbound:,}", flush=True)

    print("Writing ops_ticket_facts via REST…", flush=True)
    n = upsert_facts_rest(rows)
    print(f"Synced {n} tickets", flush=True)


if __name__ == "__main__":
    main()
