# Auth setup and troubleshooting

## If login or sign up is not working

### 1. Database schema (Supabase)

The app uses **email + password** stored in the `profiles` table. You need:

- **`profiles`** table with columns: `id`, `email`, `full_name`, `role`, **`password_hash`**, `created_at`, `updated_at`.
- **RLS** that allows the backend to read/write `profiles` (e.g. policy `profiles_all` for `anon` in `setup_database.sql`).

**Use `setup_database.sql`** (not only `supabase_schema.sql`), because:

- `setup_database.sql` adds `password_hash` and the permissive `profiles_all` policy.
- `supabase_schema.sql` ties `profiles.id` to `auth.users` and has stricter RLS, which blocks the simple login API.

### 2. No account yet

- **"User not found. Please sign up first."**  
  Create an account via **Sign up** (home page “Sign Up Now” or `/auth/signup`).

### 3. Existing user without a password

- **"Account not configured for password login. Please contact admin."**  
  The profile exists but has no `password_hash`. Either:

  - **Sign up** again with the **same email** (signup upserts and sets the password), or  
  - Set a password hash in the database (e.g. run a small script that hashes the password and updates `profiles.password_hash`).

### 4. Wrong password

- **"Invalid email or password"**  
  Check the password. There is no “forgot password” flow; use sign up with the same email to set a new password, or update `password_hash` in the DB.

### 5. Sign up / login pages not opening

- Use the **“Login page”** and **“Sign up page”** links on the home page, or go directly to:
  - `/auth/login`
  - `/auth/signup`
- If the page is blank, ensure the app is running (`npm run dev`) and check the browser console for errors.

### 6. Environment

- In `.env.local` you must have:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Restart the dev server after changing env vars.

### 7. Check setup

- Open `/api/check-setup` in the browser. It shows whether the DB is reachable and whether profiles exist (and any RLS/errors). Use this to confirm schema and connectivity.
