import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { hasServiceRoleKey } from "@/lib/operations/syncAll";
import {
  createSyncJob,
  getLatestOrdersSyncJob,
  getSyncJob,
  runOrdersSyncJob,
} from "@/lib/operations/syncJobs";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      {
        error: "SUPABASE_SERVICE_ROLE_KEY is not configured.",
        hint: "Add the service role key in Vercel environment variables and redeploy.",
      },
      { status: 503 },
    );
  }

  try {
    const jobId = await createSyncJob("orders");

    // Await full sync — Vercel terminates the function after the response,
    // so fire-and-forget background jobs never complete on serverless.
    const result = await runOrdersSyncJob(jobId);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, jobId, error: result.error ?? "Sync failed" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      jobId,
      status: "success",
      rowCount: result.rowCount,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jobId = request.nextUrl.searchParams.get("jobId");
    const job = jobId ? await getSyncJob(jobId) : await getLatestOrdersSyncJob();

    if (!job) {
      return NextResponse.json({ job: null });
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        startedAt: job.started_at,
        finishedAt: job.finished_at,
        rowCount: job.row_count,
        error: job.error_message,
        progressMessage:
          job.status === "running" || job.status === "pending"
            ? job.error_message
            : null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load sync status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
