from pathlib import Path
import os
import psycopg2

for line in Path(".env.local").read_text(encoding="utf-8").splitlines():
    if line.startswith("DATABASE_URL="):
        url = line.split("=", 1)[1].strip().strip('"').strip("'")
        break
else:
    raise SystemExit("DATABASE_URL not found")

sql = Path("patch_sku_performance_sellers_rpc.sql").read_text(encoding="utf-8")
conn = psycopg2.connect(url, connect_timeout=120)
conn.autocommit = True
with conn.cursor() as cur:
    cur.execute(sql)
conn.close()
print("Patch applied")
