/**
 * One-time / catch-up copy of picking pictures into Supabase Storage.
 * Copies only missing or changed sheet links. Leave it running until it prints remaining 0.
 *
 *   npm run sync:picking-images
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const text = readFileSync(resolve(".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // vars may already be in the environment
  }
}

loadEnv();

async function main() {
  const { getPickingImageSyncStats, syncPickingImagesUntil } = await import(
    "../src/lib/operations/syncPicking"
  );

  const before = await getPickingImageSyncStats();
  console.log(
    `Pending ${before.pending.toLocaleString()} · already in Supabase ${before.stored.toLocaleString()}`,
  );
  if (before.pending === 0) {
    console.log("Nothing to copy.");
    return;
  }

  const started = Date.now();
  const result = await syncPickingImagesUntil({
    maxMs: 0,
    concurrency: 40,
    pageSize: 500,
  });
  const secs = Math.max(1, Math.round((Date.now() - started) / 1000));
  console.log(
    `Copied ${result.copied.toLocaleString()} · failed ${result.failed.toLocaleString()} · remaining ${result.remaining.toLocaleString()} · ${secs}s (${Math.round(result.copied / secs)}/s)`,
  );
  if (result.errors.length > 0) {
    console.log(result.errors.join("\n"));
  }
  if (result.remaining > 0) {
    console.log(
      "Some pictures are still pending. Share the Drive folder as Anyone with the link, then run again.",
    );
    process.exitCode = 2;
  } else {
    console.log("All pending pictures are in Supabase.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
