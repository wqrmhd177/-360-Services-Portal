const DEFAULT_REPO = "wqrmhd177/-360-Services-Portal";
const ORDERS_WORKFLOW_FILE = "hourly-operations-sync.yml";

function parseRepo(): { owner: string; repo: string } | null {
  const raw = (process.env.GITHUB_REPO ?? DEFAULT_REPO).trim();
  const match = raw.match(/^([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export function isGitHubOrdersSyncConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN?.trim() && parseRepo());
}

/** Dispatch the hourly operations sync workflow (Metabase orders → Supabase). */
export async function dispatchOrdersSyncWorkflow(jobId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const parsed = parseRepo();

  if (!token) {
    return { ok: false, error: "GITHUB_TOKEN is not configured." };
  }
  if (!parsed) {
    return {
      ok: false,
      error: "GITHUB_REPO must be owner/repo (e.g. wqrmhd177/-360-Services-Portal).",
    };
  }

  const { owner, repo } = parsed;
  const ref = process.env.GITHUB_WORKFLOW_REF?.trim() || "main";
  const repoPath = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const response = await fetch(
    `https://api.github.com/repos/${repoPath}/actions/workflows/${ORDERS_WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: { job_id: jobId },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 401) {
      return {
        ok: false,
        error:
          "GitHub rejected the token (401 Bad credentials). Create a new PAT with Actions read/write on this repo and update GITHUB_TOKEN in Vercel.",
      };
    }
    if (response.status === 403) {
      return {
        ok: false,
        error:
          "GitHub token lacks permission to dispatch workflows (403). Ensure the PAT has Actions: Read and write for wqrmhd177/-360-Services-Portal.",
      };
    }
    return {
      ok: false,
      error: `GitHub workflow dispatch failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    };
  }

  return { ok: true };
}
