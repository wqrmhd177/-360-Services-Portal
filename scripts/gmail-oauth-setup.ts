/**
 * One-time setup: obtain GMAIL_REFRESH_TOKEN for Google Workspace accounts
 * where App Passwords are disabled by admin policy.
 *
 * Prerequisites (Google Cloud Console — https://console.cloud.google.com):
 *  1. Create a project (or use existing)
 *  2. APIs & Services → Enable "Gmail API"
 *  3. OAuth consent screen → Internal (same Workspace org) or External + test user
 *  4. Credentials → Create OAuth client ID → Desktop app
 *  5. Add redirect URI: http://localhost:3333/oauth2callback
 *
 * Then add to .env.local:
 *   GMAIL_USER=waqar@tazahtech.com
 *   GMAIL_CLIENT_ID=...
 *   GMAIL_CLIENT_SECRET=...
 *
 * Run: npx tsx scripts/gmail-oauth-setup.ts
 * Copy the printed GMAIL_REFRESH_TOKEN into .env.local and Vercel.
 */
import { createServer } from "http";
import { readFileSync } from "fs";
import { resolve } from "path";
import { OAuth2Client } from "google-auth-library";

const REDIRECT_URI = "http://localhost:3333/oauth2callback";
const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

function loadEnv() {
  try {
    const text = readFileSync(resolve(".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env.local optional if vars are already in environment
  }
}

loadEnv();

const clientId = process.env.GMAIL_CLIENT_ID?.trim();
const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
const gmailUser = process.env.GMAIL_USER?.trim() || "waqar@tazahtech.com";

if (!clientId || !clientSecret) {
  console.error(
    "Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in .env.local.\n" +
      "Create a Desktop OAuth client in Google Cloud Console first."
  );
  process.exit(1);
}

const oauth2Client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
  login_hint: gmailUser,
});

console.log("\nGmail OAuth setup for:", gmailUser);
console.log("\n1. Open this URL in your browser and sign in:\n");
console.log(authUrl);
console.log("\n2. After approving, you will be redirected to localhost.\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT_URI);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h1>Authorization failed</h1><p>${error ?? "No code received"}</p>`);
    console.error("Authorization failed:", error ?? "no code");
    server.close();
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Success!</h1><p>You can close this tab and return to the terminal.</p>");

    console.log("\n✓ Authorization successful. Add these to .env.local and Vercel:\n");
    console.log(`GMAIL_USER=${gmailUser}`);
    console.log(`GMAIL_CLIENT_ID=${clientId}`);
    console.log(`GMAIL_CLIENT_SECRET=${clientSecret}`);
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token ?? "(none — try again with prompt=consent)"}`);
    console.log(`GMAIL_FROM=360 Services Portal <${gmailUser}>`);
    console.log("\nRemove GMAIL_APP_PASSWORD if present — OAuth replaces it.\n");
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end("<h1>Token exchange failed</h1>");
    console.error("Token exchange failed:", err);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(3333, () => {
  console.log("Waiting for OAuth callback on http://localhost:3333 ...\n");
});
