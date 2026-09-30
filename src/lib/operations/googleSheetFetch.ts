import { GoogleAuth } from "google-auth-library";

const UA = "360-portal-sheet-sync/1.0";

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

type ServiceAccountCreds = {
  client_email: string;
  private_key: string;
};

function parseServiceAccountJson(): ServiceAccountCreds | null {
  const raw = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccountCreds;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Read a range via Sheets API v4 (sheet shared with service account email as Viewer). */
export async function fetchSheetRangeViaServiceAccount(
  spreadsheetId: string,
  range: string,
): Promise<string[][] | null> {
  const creds = parseServiceAccountJson();
  if (!creds) return null;

  const auth = new GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) return null;

  const encodedRange = encodeURIComponent(range);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}` +
    "?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE";

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token.token}` },
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as { values?: string[][] };
  return payload.values ?? null;
}

export function serviceAccountEmailForSheets(): string | null {
  return parseServiceAccountJson()?.client_email ?? null;
}

export function sheetAccessHelpMessage(opts: {
  sheetLabel: string;
  spreadsheetId: string;
  tabName: string;
}): string {
  const sa = serviceAccountEmailForSheets();
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${opts.spreadsheetId}/edit`;
  if (sa) {
    return (
      `${opts.sheetLabel} is not readable from the portal backend. Open the sheet (${sheetUrl}), ` +
      `share the "${opts.tabName}" tab with ${sa} as Viewer (or set General access to Anyone with the link — Viewer).`
    );
  }
  return (
    `${opts.sheetLabel} is not readable from the portal backend. Open the sheet (${sheetUrl}), ` +
    `click Share → General access → Anyone with the link → Viewer. ` +
    `Optional: set GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON in Vercel and share the sheet with that service account email instead.`
  );
}
