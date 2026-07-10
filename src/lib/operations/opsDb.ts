import { createSupabaseClient, createSupabaseServiceClient } from "@/lib/supabaseClient";

export type OpsSource = "inventory" | "channel_list" | "orders";

export function getOpsDb() {
  try {
    return createSupabaseServiceClient();
  } catch {
    return createSupabaseClient();
  }
}

export function getOpsServiceDb() {
  return createSupabaseServiceClient();
}

export async function getLastSync(source: OpsSource) {
  const supabase = getOpsDb();
  const { data } = await supabase
    .from("ops_sync_log")
    .select("synced_at, row_count, status")
    .eq("source", source)
    .eq("status", "success")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function logSync(
  source: OpsSource,
  rowCount: number,
  status: "success" | "failed",
  errorMessage?: string
) {
  try {
    const supabase = getOpsServiceDb();
    await supabase.from("ops_sync_log").insert([
      {
        source,
        row_count: rowCount,
        status,
        error_message: errorMessage ?? null,
      },
    ]);
  } catch (err) {
    console.warn("ops_sync_log insert failed:", err instanceof Error ? err.message : err);
  }
}

export async function refreshInventorySummary() {
  const supabase = getOpsServiceDb();
  const { error } = await supabase.rpc("refresh_ops_inventory_summary_simple");
  if (error) {
    console.warn("Materialized view refresh failed:", error.message);
  }
}
