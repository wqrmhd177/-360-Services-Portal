import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const text = readFileSync(resolve(".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

async function main() {
  const { gmailConfigured, sendGmailEmail } = await import("../src/lib/gmailMail");
  console.log("Gmail configured:", gmailConfigured());
  if (!gmailConfigured()) {
    console.error("Gmail OAuth vars missing in .env.local");
    process.exit(1);
  }
  const testTo = process.argv[2] || "rizwan.arshad@tazahtech.com";
  await sendGmailEmail({
    to: testTo,
    subject: "360 Portal — Password Reset Test",
    html: "<p>If you received this, Gmail OAuth is working.</p>",
  });
  console.log("Test email sent to", testTo);
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err);
  process.exit(1);
});
