/**
 * Verify Metabase public question URLs: schema, row counts, and cross-URL diff.
 * Run: npx tsx scripts/verify-metabase-fetch.ts
 */
import fs from "fs";
import path from "path";

const URLS = {
  syncDefault: "https://zambeel.metabaseapp.com/public/question/96450ced-a27c-47c9-b9cd-58fe804a7889.json",
  constantsDefault:
    "https://zambeel.metabaseapp.com/public/question/3a678d4c-3f65-433e-a451-73db490cac44.json",
};

function envUrl(): string | null {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return null;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^(METABASE_ORDERS_API_URL|METABASE_OPERATIONS_ORDERS_URL)=(.*)$/);
    if (!m) continue;
    return m[2].trim().replace(/^['"]|['"]$/g, "") || null;
  }
  return null;
}

async function fetchMetabase(name: string, url: string) {
  const t0 = Date.now();
  const res = await fetch(url, { cache: "no-store" });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) {
    return { name, url, ok: false, status: res.status, elapsed };
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    return { name, url, ok: false, error: "not a JSON array", elapsed };
  }
  const sample = data[0] as Record<string, unknown> | undefined;
  const keys = sample ? Object.keys(sample).sort() : [];
  const ids = new Set<number>();
  let missingId = 0;
  let missingOrderDate = 0;
  let missingStatus = 0;
  let duplicateLineKeys = 0;
  const lineKeys = new Set<string>();

  for (const row of data as Array<Record<string, unknown>>) {
    const id = Number(row.id);
    if (!Number.isFinite(id) || id <= 0) missingId++;
    else ids.add(id);
    if (!row.Order_date) missingOrderDate++;
    if (!String(row.status || "").trim()) missingStatus++;
    const lk = `${row.id}:${row.sku}`;
    if (lineKeys.has(lk)) duplicateLineKeys++;
    lineKeys.add(lk);
  }

  return {
    name,
    url,
    ok: true,
    elapsed: `${elapsed}s`,
    rowCount: data.length,
    distinctOrderIds: ids.size,
    lineRowsPerOrder: data.length / (ids.size || 1),
    missingId,
    missingOrderDate,
    missingStatus,
    duplicateLineKeys,
    sampleKeys: keys,
    sampleRow: sample
      ? {
          id: sample.id,
          order_number: sample.order_number,
          sku: sample.sku,
          status: sample.status,
          Order_date: sample.Order_date,
          country: sample.country,
          bifurcation: sample.bifurcation,
        }
      : null,
  };
}

async function main() {
  const configured = envUrl();
  console.log("Configured env Metabase URL:", configured ?? "(none — using code defaults)");

  const results = await Promise.all([
    fetchMetabase("syncDefault (96450ced)", URLS.syncDefault),
    fetchMetabase("constantsDefault (3a678d4c)", URLS.constantsDefault),
  ]);

  for (const r of results) {
    console.log("\n---", r.name, "---");
    console.log(JSON.stringify(r, null, 2));
  }

  if (results.every((r) => r.ok)) {
    const a = results[0]!;
    const b = results[1]!;
    console.log("\n--- URL comparison ---");
    console.log(
      JSON.stringify(
        {
          sameRowCount: a.rowCount === b.rowCount,
          rowCountDelta: (b.rowCount ?? 0) - (a.rowCount ?? 0),
          sameDistinctOrders: a.distinctOrderIds === b.distinctOrderIds,
          distinctOrdersDelta: (b.distinctOrderIds ?? 0) - (a.distinctOrderIds ?? 0),
          warning:
            a.rowCount !== b.rowCount
              ? "TWO DIFFERENT METABASE QUESTIONS — sync uses 96450ced; constants.ts default is 3a678d4c"
              : "Both URLs return same row count",
        },
        null,
        2,
      ),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
