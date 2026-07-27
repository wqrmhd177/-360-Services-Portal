import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";

function gmailUser(): string | null {
  return process.env.GMAIL_USER?.trim() || null;
}

function gmailFromAddress(user: string): string {
  const portalName = process.env.PORTAL_NAME || "360 Services Portal";
  return process.env.GMAIL_FROM?.trim() || `${portalName} <${user}>`;
}

function gmailOAuthConfigured(): boolean {
  return Boolean(
    gmailUser() &&
      process.env.GMAIL_CLIENT_ID?.trim() &&
      process.env.GMAIL_CLIENT_SECRET?.trim() &&
      process.env.GMAIL_REFRESH_TOKEN?.trim()
  );
}

function gmailAppPasswordConfigured(): boolean {
  return Boolean(gmailUser() && process.env.GMAIL_APP_PASSWORD?.trim());
}

export function gmailConfigured(): boolean {
  return gmailOAuthConfigured() || gmailAppPasswordConfigured();
}

function createOAuthClient(): OAuth2Client {
  return new OAuth2Client(
    process.env.GMAIL_CLIENT_ID!.trim(),
    process.env.GMAIL_CLIENT_SECRET!.trim()
  );
}

function encodeMimeMessage(from: string, to: string, subject: string, html: string): string {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendViaGmailApi(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const user = gmailUser()!;
  const from = gmailFromAddress(user);
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN!.trim(),
  });

  const accessTokenResponse = await oauth2Client.getAccessToken();
  const accessToken = accessTokenResponse.token;
  if (!accessToken) {
    throw new Error("Failed to obtain Gmail OAuth access token.");
  }

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encodeMimeMessage(from, options.to, options.subject, options.html),
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gmail API send failed (${response.status}): ${body}`);
  }
}

async function sendViaSmtp(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const user = gmailUser()!;
  const pass = process.env.GMAIL_APP_PASSWORD!.replace(/\s/g, "");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: gmailFromAddress(user),
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

export async function sendGmailEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!gmailUser()) {
    throw new Error("GMAIL_USER is not set.");
  }

  if (gmailOAuthConfigured()) {
    await sendViaGmailApi(options);
    return;
  }

  if (gmailAppPasswordConfigured()) {
    await sendViaSmtp(options);
    return;
  }

  throw new Error("Gmail is not configured.");
}
