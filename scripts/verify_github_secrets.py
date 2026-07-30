#!/usr/bin/env python3
"""Validate sync env vars (local .env.local or CI secrets). Never prints secrets."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_env_local() -> None:
    env_path = ROOT / ".env.local"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)


def check(name: str, ok: bool, detail: str = "") -> bool:
    status = "PASS" if ok else "FAIL"
    suffix = f" — {detail}" if detail else ""
    print(f"{status}: {name}{suffix}")
    return ok


def main() -> int:
    load_env_local()
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from sync_orders import has_postgres_config, resolve_database_url, supabase_url

    all_ok = True

    url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    db_password = (os.environ.get("SUPABASE_DB_PASSWORD") or "").strip()
    db_url = (os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL") or "").strip()

    all_ok &= check("NEXT_PUBLIC_SUPABASE_URL present", bool(url))
    all_ok &= check("NEXT_PUBLIC_SUPABASE_URL uses https://", url.startswith("https://"))
    all_ok &= check(
        "SUPABASE_SERVICE_ROLE_KEY present",
        bool(key),
        "GitHub secret name must be exactly SUPABASE_SERVICE_ROLE_KEY",
    )
    all_ok &= check(
        "SUPABASE_SERVICE_ROLE_KEY looks like JWT",
        key.startswith("eyJ") and key.count(".") == 2,
    )
    all_ok &= check(
        "Postgres credentials present",
        has_postgres_config(),
        "Add GitHub secret SUPABASE_DB_PASSWORD (database password only)",
    )
    all_ok &= check(
        "SUPABASE_DB_PASSWORD or DATABASE_URL set",
        bool(db_password or db_url),
    )

    if db_url and "db." in db_url and ".supabase.co" in db_url and not db_password:
        check(
            "DATABASE_URL uses direct host (IPv6)",
            False,
            "Prefer SUPABASE_DB_PASSWORD only — sync auto-uses IPv4 pooler",
        )

    if has_postgres_config():
        try:
            resolved = resolve_database_url()
            host = resolved.split("@", 1)[1].split("/", 1)[0]
            all_ok &= check("Postgres connection (auto-resolved pooler)", True, host)
        except Exception as exc:
            all_ok &= check(
                "Postgres connection (auto-resolved pooler)",
                False,
                str(exc).split("\n")[0][:160],
            )

        try:
            import psycopg2

            from sync_orders import get_database_url

            conn = psycopg2.connect(get_database_url(), connect_timeout=20)
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT 1 FROM pg_proc WHERE proname = 'refresh_ops_orders_summaries_simple'"
                    )
                    exists = cur.fetchone() is not None
                all_ok &= check("refresh_ops_orders_summaries_simple() exists in DB", exists)
            finally:
                conn.close()
        except Exception as exc:
            all_ok &= check(
                "refresh_ops_orders_summaries_simple() exists in DB",
                False,
                str(exc).split("\n")[0][:120],
            )

    rest_url = supabase_url()
    all_ok &= check("Supabase REST URL available", bool(rest_url))

    for name in ("VERCEL_PRODUCTION_URL", "CRON_SECRET"):
        check(f"{name} (optional)", bool((os.environ.get(name) or "").strip()))

    print()
    if all_ok:
        print("All required checks passed.")
        return 0
    print("Some checks failed — fix items above before the next hourly sync.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
