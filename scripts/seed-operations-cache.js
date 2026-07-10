/**
 * Seed Operations cache from Metabase into Supabase.
 * Run: node scripts/seed-operations-cache.js
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) return;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[name]) process.env[name] = value;
  });
}

const METABASE_INVENTORY =
  "https://zambeel.metabaseapp.com/public/question/316b4595-6180-43fe-b635-839b7f479c26.json";
const METABASE_CHANNELS =
  "https://zambeel.metabaseapp.com/public/question/4a368bc7-82ae-417d-b182-cfe3e3df7490.json";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);
const BATCH = 500;

function normalizeSku(v) {
  return String(v ?? "").trim().replace(/^,+/, "").toUpperCase();
}

function normalizeInventory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    user_id: r.sku_owner_id == null || r.sku_owner_id === "" ? null : String(r.sku_owner_id),
    username: r.sku_owner_username || null,
    product_name: String(r.sku_title ?? ""),
    sku: normalizeSku(r.sku) || String(r.sku ?? "").trim(),
    available_quantity: Number(r.quantity ?? 0),
    country: String(r.warehouse_name ?? ""),
    category: String(r.category ?? ""),
  }));
}

function normalizeChannels(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    store_id: Number(r.store_id ?? 0),
    user_id: Number(r.user_id ?? 0),
    store_name: String(r.store_name ?? ""),
    store_url: String(r.store_url ?? ""),
    platform: String(r.platform ?? ""),
    bifurcation: String(r.bifurcation ?? ""),
    confirmation_setting: String(r.confirmation_setting ?? ""),
  }));
}

async function fetchJson(u) {
  const res = await fetch(u, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`Fetch failed ${u}: ${res.status}`);
  return res.json();
}

async function replaceTable(table, rows) {
  const syncedAt = new Date().toISOString();
  const { error: delErr } = await supabase.from(table).delete().gte("id", 0);
  if (delErr) throw new Error(`Delete ${table}: ${delErr.message}`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH).map((r) => ({ ...r, synced_at: syncedAt }));
    const { error } = await supabase.from(table).insert(slice);
    if (error) throw new Error(`Insert ${table} batch ${i}: ${error.message}`);
  }
}

async function logSync(source, rowCount, status, errorMessage) {
  await supabase.from("ops_sync_log").insert([
    { source, row_count: rowCount, status, error_message: errorMessage ?? null },
  ]);
}

async function main() {
  console.log("Fetching inventory from Metabase…");
  const invRows = normalizeInventory(await fetchJson(METABASE_INVENTORY));
  console.log(`  → ${invRows.length} inventory rows`);
  await replaceTable("ops_inventory_items", invRows);
  await supabase.rpc("refresh_ops_inventory_summary_simple");
  await logSync("inventory", invRows.length, "success");
  console.log("  ✓ Inventory synced");

  console.log("Fetching channel list from Metabase…");
  const chRows = normalizeChannels(await fetchJson(METABASE_CHANNELS));
  console.log(`  → ${chRows.length} channel rows`);
  await replaceTable("ops_channel_list_items", chRows);
  await logSync("channel_list", chRows.length, "success");
  console.log("  ✓ Channel list synced");

  console.log("\nDone. Live users can now load data instantly from Supabase.");
}

main().catch((err) => {
  console.error("\n✗", err.message);
  process.exit(1);
});
