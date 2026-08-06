"""Verify anon key cannot read portal tables after patch_security_lockdown.sql."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path


def load_env(name: str) -> str:
    for line in Path(".env.local").read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit(f"{name} not found in .env.local")


def probe_table(base_url: str, anon: str, table: str) -> tuple[bool, str]:
    rest = f"{base_url.rstrip('/')}/rest/v1/{table}?select=*&limit=5"
    req = urllib.request.Request(
        rest,
        headers={"apikey": anon, "Authorization": f"Bearer {anon}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode()
            data = json.loads(body) if body else []
            if isinstance(data, list) and len(data) == 0:
                return True, f"{table}: empty (OK)"
            return False, f"{table}: returned {len(data) if isinstance(data, list) else 'data'} rows"
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:160]
        if e.code in (401, 403):
            return True, f"{table}: {e.code} forbidden (OK)"
        return False, f"{table}: HTTP {e.code} — {body}"


def main() -> None:
    base_url = load_env("NEXT_PUBLIC_SUPABASE_URL")
    anon = load_env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    tables = ["profiles", "pl_products", "ops_orders_items"]
    results = [probe_table(base_url, anon, t) for t in tables]
    ok = all(r[0] for r in results)
    for _, msg in results:
        print(msg)
    print("OVERALL:", "LOCKDOWN VERIFIED" if ok else "LOCKDOWN MAY NOT BE COMPLETE")
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
