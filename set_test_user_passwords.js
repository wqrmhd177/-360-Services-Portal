// Script to set plain passwords + bcrypt hashes for test users
// Run: node set_test_user_passwords.js
// Then copy the SQL output into Supabase SQL Editor

const bcrypt = require("bcryptjs");

const testUsers = [
  { email: "waqar@tazahtech.com", password: "Pakistan123" },
  { email: "ilqa@tazahtech.com", password: "Pakistan123" },
  { email: "moazam@tazahtech.com", password: "Pakistan123" },
  { email: "saif@tazahtech.com", password: "Pakistan123" },
];

async function generateHashes() {
  console.log("-- Set plain password + hash for test users");
  console.log("-- Requires: run add_password_column.sql first\n");

  for (const user of testUsers) {
    const hash = await bcrypt.hash(user.password, 12);
    console.log(`UPDATE public.profiles`);
    console.log(`SET password = '${user.password}',`);
    console.log(`    password_hash = '${hash}',`);
    console.log(`    updated_at = now()`);
    console.log(`WHERE email = '${user.email}';\n`);
  }

  console.log("-- Verify:");
  console.log(`SELECT email, full_name, role, password, password_hash IS NOT NULL AS has_hash`);
  console.log(`FROM public.profiles`);
  console.log(
    `WHERE email IN ('waqar@tazahtech.com', 'ilqa@tazahtech.com', 'moazam@tazahtech.com', 'saif@tazahtech.com');`
  );
}

generateHashes().catch(console.error);
