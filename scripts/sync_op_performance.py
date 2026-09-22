"""Sync OP Performance Raw Data (selected columns) into ops_op_facts.

Column map:
  C Upsell Agreed, D Upsell Pitched, F Order Date, G Tags,
  H Unique Order ID, M Country, AF Status,
  AI OP_remarks ("Team A" = lucky draw pitched).
Optional: A NDR Date, E CS Status, I order_number. No PII is stored.
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
SHEET_ID = "1sd2MZuKjMLiX7MdIusIypUBr74okVEmUO8MCH6TO4cM"
RAW_DATA_GID = "1966223894"
# Google Visualization letters: A=1 … H=8 … M=13 … AF=32 … AI=35.
SELECT_COLS = "A,C,D,E,F,G,H,I,M,AF,AI"
UA = {"User-Agent": "Mozilla/5.0 (compatible; 360-portal-op-sync/1.0)"}
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


def parse_yes_no(raw: str) -> bool | None:
    val = " ".join(raw.strip().lower().split())
    if not val:
        return None
    # Column C is "Agreed" / "Not Agreed"; column D is "Yes" / "No".
    if val in ("yes", "y", "true", "1", "agreed"):
        return True
    if val in ("no", "n", "false", "0", "not agreed", "not-agreed"):
        return False
    return None


def parse_date(raw: str) -> date | None:
    val = raw.strip()
    if not val:
        return None
    m = re.fullmatch(r"(\d{1,2})-([A-Za-z]{3})-(\d{2,4})", val)
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
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d"):
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


def parse_source_id(raw: str) -> int | None:
    val = raw.strip().replace(",", "")
    if not val:
        return None
    if val.endswith(".0"):
        val = val[:-2]
    if val.isdigit():
        try:
            return int(val)
        except ValueError:
            return None
    return None


def is_lucky_draw_pitched(raw: str) -> bool:
    for part in raw.split(","):
        token = " ".join(part.strip().lower().split())
        if token in ("team a", "teama"):
            return True
    return False


def header_index(headers: list[str], *names: str) -> int | None:
    lower = [h.strip().lower() for h in headers]
    for name in names:
        if name in lower:
            return lower.index(name)
    for i, h in enumerate(lower):
        for name in names:
            if name and name in h:
                return i
    return None


def fetch_raw_csv() -> str:
    tq = urllib.parse.quote(f"select {SELECT_COLS}")
    url = (
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq"
        f"?tqx=out:csv&gid={RAW_DATA_GID}&tq={tq}"
    )
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, context=CTX, timeout=180) as resp:
        data = resp.read()
        final = resp.geturl()
        text = data.decode("utf-8", "replace")
    if "accounts.google.com" in final or text.lstrip().startswith("<!"):
        raise RuntimeError(
            "OP Raw Data is not readable. Share the sheet with the sync "
            "service account, or keep the Raw Data tab reachable for backend sync."
        )
    return text


def parse_facts(text: str) -> list[tuple]:
    reader = csv.reader(io.StringIO(text))
    try:
        headers = next(reader)
    except StopIteration:
        return []

    i_id = header_index(headers, "unique order id", "id")
    i_date = header_index(headers, "order date")
    i_tag = header_index(headers, "tags", "tag")
    i_country = header_index(headers, "country")
    i_status = header_index(headers, "status")
    i_agreed = header_index(headers, "upsell agreed")
    i_pitched = header_index(headers, "upsell pitched")
    i_cs = header_index(headers, "cs status")
    i_ndr = header_index(headers, "ndr date")
    i_num = header_index(headers, "order_number", "order number")
    i_lucky = header_index(headers, "op_remarks", "op remarks")

    if i_id is None or i_date is None or i_country is None or i_status is None:
        raise RuntimeError(f"Missing mapped headers in Raw Data: {headers}")

    by_id: dict[int, dict] = {}
    skipped = 0
    for row in reader:
        def cell(idx: int | None) -> str:
            if idx is None or idx >= len(row):
                return ""
            return row[idx].strip()

        source_id = parse_source_id(cell(i_id))
        if source_id is None:
            skipped += 1
            continue
        remarks = cell(i_lucky)
        pitched = is_lucky_draw_pitched(remarks)
        by_id[source_id] = {
            "source_id": source_id,
            "order_number": cell(i_num) or None,
            "order_date": parse_date(cell(i_date)),
            "ndr_date": parse_date(cell(i_ndr)),
            "upsell_agreed": parse_yes_no(cell(i_agreed)),
            "upsell_pitched": parse_yes_no(cell(i_pitched)),
            "cs_status": cell(i_cs) or None,
            "op_tag": cell(i_tag) or None,
            "country": cell(i_country) or None,
            "status": cell(i_status) or None,
            "lucky_draw_pitched": pitched,
            "op_remarks": remarks or None,
            "reschedule_check": "Team A" if pitched else None,
        }
    print(f"  parsed {len(by_id)} unique orders, skipped {skipped} without id", flush=True)
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
        detail = exc.read()[:400].decode("utf-8", "replace")
        raise RuntimeError(f"REST {method} {path} failed ({exc.code}): {detail}") from exc


def fact_payload(row: dict, synced_at: str, mode: str) -> dict:
    pitched = bool(row.get("lucky_draw_pitched"))
    payload = {
        "source_id": row["source_id"],
        "order_number": row["order_number"],
        "order_date": iso(row["order_date"]),
        "ndr_date": iso(row["ndr_date"]),
        "upsell_agreed": row["upsell_agreed"],
        "upsell_pitched": row["upsell_pitched"],
        "cs_status": row["cs_status"],
        "op_tag": row["op_tag"],
        "country": row["country"],
        "status": row["status"],
        "reschedule_check": "Team A" if pitched else None,
        "synced_at": synced_at,
    }
    if mode == "full":
        payload["lucky_draw_pitched"] = pitched
        payload["op_remarks"] = row.get("op_remarks")
    return payload


def upsert_facts_rest(rows: list[dict]) -> int:
    synced_at = datetime.now(timezone.utc).isoformat()
    print("  clearing previous OP facts via REST…", flush=True)
    rest_request("/rest/v1/ops_op_facts?source_id=gte.0", "DELETE")

    mode = "full"
    batch = 500
    total = len(rows)
    i = 0
    while i < total:
        chunk = [fact_payload(row, synced_at, mode) for row in rows[i : i + batch]]
        try:
            rest_request(
                "/rest/v1/ops_op_facts?on_conflict=source_id",
                "POST",
                json.dumps(chunk).encode("utf-8"),
            )
        except RuntimeError as exc:
            msg = str(exc).lower()
            if mode == "full" and (
                "schema cache" in msg
                or "lucky_draw" in msg
                or "op_remarks" in msg
                or "pgrst204" in msg
            ):
                print(
                    "  lucky_draw columns not in schema yet; storing Team A on reschedule_check",
                    flush=True,
                )
                mode = "legacy"
                continue
            raise
        i += batch
        done = min(i, total)
        if done == total or done % 5000 == 0:
            print(f"  … {done:,} / {total:,} orders", flush=True)

    try:
        rest_request(
            "/rest/v1/ops_sync_log",
            "POST",
            json.dumps(
                [{"source": "op_performance", "row_count": total, "status": "success"}]
            ).encode("utf-8"),
        )
    except Exception as exc:
        print(f"  WARN sync log write failed: {exc}", flush=True)
    return total


def main() -> None:
    load_env()
    print("Fetching OP Raw Data (mapped columns only)…", flush=True)
    text = fetch_raw_csv()
    print(f"  csv bytes={len(text.encode('utf-8'))}", flush=True)
    rows = parse_facts(text)

    print("Writing ops_op_facts via REST…", flush=True)
    n = upsert_facts_rest(rows)
    print(f"Synced {n} orders", flush=True)

    from collections import Counter

    print("Tag volumes:", flush=True)
    tags = Counter((row["op_tag"] or "Untagged") for row in rows)
    for tag, count in tags.most_common():
        print(f"  {count:>7}  {tag}", flush=True)
    lucky = sum(1 for row in rows if row.get("lucky_draw_pitched"))
    lucky_delivered = sum(
        1
        for row in rows
        if row.get("lucky_draw_pitched")
        and "deliver" in (row.get("status") or "").lower()
        and "undeliver" not in (row.get("status") or "").lower()
    )
    pitched = sum(1 for row in rows if row.get("upsell_pitched") is True)
    agreed = sum(1 for row in rows if row.get("upsell_agreed") is True)
    print(f"Upsell pitched: {pitched:,}", flush=True)
    print(f"Upsell agreed: {agreed:,}", flush=True)
    print(f"Lucky draw pitched: {lucky:,}", flush=True)
    print(f"Lucky draw pitched & delivered: {lucky_delivered:,}", flush=True)


if __name__ == "__main__":
    main()

