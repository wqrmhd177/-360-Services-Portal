// Script to generate password hashes for test users
// Run this with: node set_test_user_passwords.js
// Then copy the SQL output and run it in Supabase SQL Editor

const bcrypt = require('bcryptjs');

const testUsers = [
  { email: 'waqar@tazahtech.com', password: 'Pakistan123' },
  { email: 'ilqa@tazahtech.com', password: 'Pakistan123' },
  { email: 'moazam@tazahtech.com', password: 'Pakistan123' },
  { email: 'saif@tazahtech.com', password: 'Pakistan123' }
];

async function generateHashes() {
  console.log('-- Set password hashes for test users');
  console.log('-- Run this SQL in Supabase SQL Editor\n');
  
  for (const user of testUsers) {
    const hash = await bcrypt.hash(user.password, 12);
    console.log(`UPDATE public.profiles`);
    console.log(`SET password_hash = '${hash}'`);
    console.log(`WHERE email = '${user.email}';\n`);
  }
  
  console.log('-- Verify passwords were set:');
  console.log(`SELECT email, full_name, role, password_hash IS NOT NULL as has_password`);
  console.log(`FROM public.profiles`);
  console.log(`WHERE email IN ('waqar@tazahtech.com', 'ilqa@tazahtech.com', 'moazam@tazahtech.com', 'saif@tazahtech.com');`);
}

generateHashes().catch(console.error);
