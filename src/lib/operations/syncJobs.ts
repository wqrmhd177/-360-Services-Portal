import { getOpsServiceDb } from "@/lib/operations/opsDb";
import { syncOrdersFromMetabase } from "@/lib/operations/syncOrders";

export type SyncJobStatus = "pending" | "running" | "success" | "failed";

export type SyncJobRecord = {
  id: string;
  source: string;
  status: SyncJobStatus;
  started_at: string;
  finished_at: string | null;
  row_count: number;
  error_message: string | null;
};

const STUCK_JOB_MS = 8 * 60 * 1000;

export async function createSyncJob(source: "orders"): Promise<string> {
  const supabase = getOpsServiceDb();
  const { data, error } = await supabase
    .from("ops_sync_jobs")
    .insert([{ source, status: "pending" }])
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to create sync job");
  }

  return data.id as string;
}

export async function updateSyncJob(
  jobId: string,
  patch: Partial<{
    status: SyncJobStatus;
    finished_at: string;
    row_count: number;
    error_message: string | null;
  }>,
) {
  const supabase = getOpsServiceDb();
  await supabase.from("ops_sync_jobs").update(patch).eq("id", jobId);
}

export async function getSyncJob(jobId: string): Promise<SyncJobRecord | null> {
  const supabase = getOpsServiceDb();
  const { data, error } = await supabase
    .from("ops_sync_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const job = (data as SyncJobRecord | null) ?? null;
  if (!job) return null;

  return normalizeStuckJob(job);
}

export async function getLatestOrdersSyncJob(): Promise<SyncJobRecord | null> {
  const supabase = getOpsServiceDb();
  const { data, error } = await supabase
    .from("ops_sync_jobs")
    .select("*")
    .eq("source", "orders")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const job = (data as SyncJobRecord | null) ?? null;
  if (!job) return null;

  return normalizeStuckJob(job);
}

async function normalizeStuckJob(job: SyncJobRecord): Promise<SyncJobRecord> {
  if (job.status !== "pending" && job.status !== "running") {
    return job;
  }

  const startedMs = new Date(job.started_at).getTime();
  if (Date.now() - startedMs < STUCK_JOB_MS) {
    return job;
  }

  const msg =
    "Sync timed out or was interrupted. Please click Sync Data again.";
  await updateSyncJob(job.id, {
    status: "failed",
    finished_at: new Date().toISOString(),
    error_message: msg,
  });

  return {
    ...job,
    status: "failed",
    finished_at: new Date().toISOString(),
    error_message: msg,
  };
}

/** Run sync to completion — must be awaited (Vercel kills fire-and-forget work). */
export async function runOrdersSyncJob(jobId: string) {
  await updateSyncJob(jobId, { status: "running" });

  const result = await syncOrdersFromMetabase({ jobId });

  if (result.ok) {
    await updateSyncJob(jobId, {
      status: "success",
      finished_at: new Date().toISOString(),
      row_count: result.rowCount,
      error_message: null,
    });
    return result;
  }

  await updateSyncJob(jobId, {
    status: "failed",
    finished_at: new Date().toISOString(),
    row_count: 0,
    error_message: result.error ?? "Sync failed",
  });

  return result;
}
