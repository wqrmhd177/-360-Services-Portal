/**
 * Compare Metabase fetch vs Supabase for status sync accuracy.
 * Run: npx tsx scripts/verify-metabase-sync.ts
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const METABASE_URL =
  "https://zambeel.metabaseapp.com/public/question/96450ced-a27c-47c9-b9cd-58fe804a7889.json";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, "");
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  console.log("Fetching Metabase (sync URL)...", METABASE_URL);
  const t0 = Date.now();
  const res = await fetch(METABASE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Metabase HTTP ${res.status}`);
  const metabase = (await res.json()) as Array<Record<string, unknown>>;
  console.log(`Metabase: ${metabase.length} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const mbByLine = new Map<string, { status: string; order_date: string }>();
  const mbByOrder = new Map<number, Map<string, string>>();

  for (const row of metabase) {
    const id = Number(row.id);
    const sku = String(row.sku || "");
    const key = `${id}:${sku}`;
    const status = String(row.status || "").trim();
    mbByLine.set(key, { status, order_date: String(row.Order_date || "") });
    if (!mbByOrder.has(id)) mbByOrder.set(id, new Map());
    mbByOrder.get(id)!.set(sku, status);
  }

  const { count: dbLineCount } = await sb
    .from("ops_orders_items")
    .select("*", { count: "exact", head: true });

  const dbLineKeys = new Set<string>();
  let offset = 0;
  let statusMismatch = 0;
  let missingInDb = 0;
  let missingInMb = 0;
  let checked = 0;
  const mismatchSamples: unknown[] = [];

  while (true) {
    const { data, error } = await sb
      .from("ops_orders_items")
      .select("order_id, sku, status, synced_at")
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      checked++;
      const key = `${row.order_id}:${row.sku}`;
      dbLineKeys.add(key);
      const mb = mbByLine.get(key);
      if (!mb) {
        missingInMb++;
        continue;
      }
      const dbStatus = String(row.status || "").trim();
      if (dbStatus !== mb.status) {
        statusMismatch++;
        if (mismatchSamples.length < 8) {
          mismatchSamples.push({
            order_id: row.order_id,
            sku: row.sku,
            dbStatus,
            metabaseStatus: mb.status,
            synced_at: row.synced_at,
          });
        }
      }
    }
    if (data.length < 1000) break;
    offset += 1000;
  }

  for (const key of mbByLine.keys()) {
    if (!dbLineKeys.has(key)) missingInDb++;
  }

  console.log(
    JSON.stringify(
      {
        metabaseLineRows: metabase.length,
        metabaseDistinctOrders: mbByOrder.size,
        supabaseLineRows: dbLineCount,
        linesCompared: checked,
        statusMismatchLines: statusMismatch,
        linesInDbNotInMetabase: missingInMb,
        linesInMetabaseNotInDb: missingInDb,
        mismatchRatePct: checked ? ((statusMismatch / checked) * 100).toFixed(2) : 0,
        samples: mismatchSamples,
        fetchOk: true,
        syncUrl: METABASE_URL,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
