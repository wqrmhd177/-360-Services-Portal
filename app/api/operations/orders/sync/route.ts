import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { dispatchOrdersSyncWorkflow, isGitHubOrdersSyncConfigured } from "@/lib/operations/githubWorkflow";
import { hasServiceRoleKey } from "@/lib/operations/syncAll";
import {
  createSyncJob,
  getLatestOrdersSyncJob,
  getSyncJob,
  runOrdersSyncJob,
  updateSyncJob,
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
    const latest = await getLatestOrdersSyncJob();
    if (latest && (latest.status === "pending" || latest.status === "running")) {
      return NextResponse.json(
        {
          ok: false,
          error: "A sync is already in progress. Please wait for it to finish.",
          jobId: latest.id,
          dispatched: true,
        },
        { status: 409 },
      );
    }

    const jobId = await createSyncJob("orders");

    if (isGitHubOrdersSyncConfigured()) {
      await updateSyncJob(jobId, {
        status: "running",
        error_message: "Sync queued on GitHub Actions…",
      });

      const dispatched = await dispatchOrdersSyncWorkflow(jobId);
      if (!dispatched.ok) {
        await updateSyncJob(jobId, {
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: dispatched.error ?? "Failed to start GitHub workflow",
        });
        return NextResponse.json(
          { ok: false, jobId, error: dispatched.error ?? "Failed to start GitHub workflow" },
          { status: 502 },
        );
      }

      await updateSyncJob(jobId, {
        status: "running",
        error_message: "Sync running on GitHub Actions — this usually takes 2–5 minutes.",
      });

      return NextResponse.json({
        ok: true,
        jobId,
        dispatched: true,
        status: "running",
        message: "Orders sync started on GitHub Actions. Keep this tab open to track progress.",
      });
    }

    // Local fallback when GITHUB_TOKEN is not set (e.g. dev without GitHub Actions).
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
      dispatched: false,
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
