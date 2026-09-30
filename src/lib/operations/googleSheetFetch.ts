import { GoogleAuth } from "google-auth-library";

const UA = "360-portal-sheet-sync/1.0";

export type ServiceAccountConfigStatus =
  | { ok: true; clientEmail: string }
  | { ok: false; reason: string };

type ServiceAccountCreds = {
  client_email: string;
  private_key: string;
};

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n").trim();
}

/** Parse service account JSON from Vercel-friendly env vars. */
export function getServiceAccountConfigStatus(): ServiceAccountConfigStatus {
  const b64 = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_BASE64?.trim();
  let raw = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim();

  if (b64) {
    try {
      raw = Buffer.from(b64, "base64").toString("utf-8");
    } catch {
      return {
        ok: false,
        reason:
          "GOOGLE_SHEETS_SERVICE_ACCOUNT_BASE64 is set but is not valid base64.",
      };
    }
  }

  if (!raw) {
    return {
      ok: false,
      reason:
        "Neither GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON nor GOOGLE_SHEETS_SERVICE_ACCOUNT_BASE64 is set on the server.",
    };
  }

  if (raw.startsWith("{")) {
    // ok
  } else if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      raw = JSON.parse(raw) as string;
    } catch {
      return {
        ok: false,
        reason:
          "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON looks like a quoted string but is not valid JSON.",
      };
    }
  }

  try {
    const parsed = JSON.parse(raw) as ServiceAccountCreds;
    const email = parsed.client_email?.trim();
    const key = parsed.private_key ? normalizePrivateKey(parsed.private_key) : "";
    if (!email || !key.includes("BEGIN PRIVATE KEY")) {
      return {
        ok: false,
        reason:
          "Service account JSON parsed but client_email or private_key is missing (check Vercel env — paste minified JSON on one line).",
      };
    }
    return { ok: true, clientEmail: email };
  } catch {
    return {
      ok: false,
      reason:
        "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON is set but JSON.parse failed. Use minified one-line JSON or GOOGLE_SHEETS_SERVICE_ACCOUNT_BASE64 instead.",
    };
  }
}

function parseServiceAccountJson(): ServiceAccountCreds | null {
  const status = getServiceAccountConfigStatus();
  if (!status.ok) return null;

  const b64 = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_BASE64?.trim();
  let raw = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim();
  if (b64) {
    raw = Buffer.from(b64, "base64").toString("utf-8");
  }
  if (!raw) return null;
  if (raw.startsWith('"') && raw.endsWith('"')) {
    raw = JSON.parse(raw) as string;
  }
  const parsed = JSON.parse(raw) as ServiceAccountCreds;
  return {
    client_email: parsed.client_email.trim(),
    private_key: normalizePrivateKey(parsed.private_key),
  };
}

function looksLikeLoginPage(text: string, finalUrl?: string): boolean {
  const t = text.trimStart();
  if (t.startsWith("<!") || t.startsWith("<html")) return true;
  if (finalUrl && finalUrl.includes("accounts.google.com")) return true;
  return false;
}

/** Try anonymous Google Sheet CSV / gviz export URLs (sheet must be link-shared as Viewer). */
export async function fetchSheetCsvFromPublicUrls(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        headers: { "User-Agent": UA },
      });
      const text = await res.text();
      if (!res.ok || looksLikeLoginPage(text, res.url)) continue;
      if (text.trim().length === 0) continue;
      return text;
    } catch {
      // try next URL
    }
  }
  return null;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function valuesToCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ""))).join(","))
    .join("\n");
}

export type SheetRangeFetchResult =
  | { ok: true; values: string[][] }
  | { ok: false; reason: string };

/** Read a range via Sheets API v4 (sheet shared with service account email as Viewer). */
export async function fetchSheetRangeViaServiceAccount(
  spreadsheetId: string,
  range: string,
): Promise<SheetRangeFetchResult> {
  const configStatus = getServiceAccountConfigStatus();
  if (!configStatus.ok) {
    return { ok: false, reason: configStatus.reason };
  }

  const creds = parseServiceAccountJson();
  if (!creds) {
    return { ok: false, reason: "Service account credentials could not be loaded." };
  }

  let token: string | null | undefined;
  try {
    const auth = new GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const client = await auth.getClient();
    token = (await client.getAccessToken()).token;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: `Google auth failed for ${configStatus.clientEmail}: ${msg}`,
    };
  }

  if (!token) {
    return { ok: false, reason: "Google access token was empty." };
  }

  const encodedRange = encodeURIComponent(range);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}` +
    "?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE";

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  const bodyText = await res.text();
  if (!res.ok) {
    let detail = bodyText.slice(0, 400);
    try {
      const j = JSON.parse(bodyText) as { error?: { message?: string; status?: string } };
      detail = j.error?.message ?? detail;
    } catch {
      /* use raw */
    }
    if (res.status === 403) {
      return {
        ok: false,
        reason:
          `Google Sheets API permission denied (403). Share the spreadsheet with ${configStatus.clientEmail} as Viewer, ` +
          `and enable "Google Sheets API" for the GCP project that owns this service account. Detail: ${detail}`,
      };
    }
    return {
      ok: false,
      reason: `Google Sheets API error (${res.status}) for range "${range}": ${detail}`,
    };
  }

  let payload: { values?: string[][] };
  try {
    payload = JSON.parse(bodyText) as { values?: string[][] };
  } catch {
    return { ok: false, reason: "Google Sheets API returned non-JSON." };
  }

  if (!payload.values?.length) {
    return {
      ok: false,
      reason: `No rows returned for range "${range}". Confirm the tab is named exactly "${range.split("!")[0]?.replace(/^'|'$/g, "")}".`,
    };
  }

  return { ok: true, values: payload.values };
}

export function serviceAccountEmailForSheets(): string | null {
  const status = getServiceAccountConfigStatus();
  return status.ok ? status.clientEmail : null;
}

export function sheetAccessHelpMessage(opts: {
  sheetLabel: string;
  spreadsheetId: string;
  tabName: string;
  serviceAccountFailure?: string;
}): string {
  const status = getServiceAccountConfigStatus();
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${opts.spreadsheetId}/edit`;

  if (opts.serviceAccountFailure) {
    return `${opts.sheetLabel} could not be loaded.\n\n${opts.serviceAccountFailure}\n\nSheet: ${sheetUrl}`;
  }

  if (status.ok) {
    return (
      `${opts.sheetLabel} is not readable from the portal backend. Open the sheet (${sheetUrl}), ` +
      `click Share, and add ${status.clientEmail} as Viewer (Editor also works). ` +
      `Also enable "Google Sheets API" in Google Cloud Console for project tied to that service account.`
    );
  }

  return (
    `${opts.sheetLabel} is not readable from the portal backend. Open the sheet (${sheetUrl}), ` +
    `click Share → General access → Anyone with the link → Viewer.\n\n` +
    `Or configure a service account in Vercel: ${status.reason}`
  );
}
