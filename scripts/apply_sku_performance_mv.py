"""Apply setup_sku_performance_mv.sql to Supabase."""
from __future__ import annotations

import os
from pathlib import Path

import psycopg2


def load_database_url() -> str:
    env_path = Path(".env.local")
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not url:
        raise SystemExit("DATABASE_URL not found")
    return url


def main() -> None:
    sql = Path("setup_sku_performance_mv.sql").read_text(encoding="utf-8")
    conn = psycopg2.connect(load_database_url(), connect_timeout=120)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        print("SQL applied successfully")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
