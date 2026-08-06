import fs from "fs";
import { METABASE_INVENTORY_URL } from "../src/lib/constants";
import { parseMetabaseInventoryPayload } from "../src/lib/operations/inventory";

function loadEnvUrl(): string | null {
  const envPath = ".env.local";
  if (!fs.existsSync(envPath)) return null;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^METABASE_INVENTORY_API_URL=(.*)$/);
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, "") || null;
  }
  return null;
}

async function main() {
  const url = loadEnvUrl() ?? METABASE_INVENTORY_URL;
  const res = await fetch(url, { cache: "no-store" });
  const raw = await res.json();
  const records = parseMetabaseInventoryPayload(raw);
  console.log("rowCount", records.length);
  if (records[0]) {
    console.log("keys", Object.keys(records[0]).sort().join(", "));
    console.log("sample", JSON.stringify(records[0], null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
