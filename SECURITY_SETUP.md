# Security setup — lock down Supabase public access

Supabase security alerts (`rls_disabled_in_public`, sensitive data exposed) mean the **anon** API key must not be able to read or write portal data. This portal uses **custom cookie auth** (`portal_session`), not Supabase Auth, so all database access goes through **authenticated Next.js API routes** using the **service role key on the server only**.

## Architecture

```
Browser (logged in)
  → middleware checks portal_session cookie
  → /api/* routes (session required)
  → SUPABASE_SERVICE_ROLE_KEY (server only, never in browser bundle)
  → Postgres (RLS enabled, anon/authenticated revoked)
```

Direct calls to `https://<project>.supabase.co/rest/v1/...` with the anon key **must return no data** after the lockdown patch.

## 1. Vercel / local env

Ensure these are set (service role **must not** be prefixed with `NEXT_PUBLIC_`):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only DB access (API routes) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | May remain for legacy init; **no table grants** after lockdown |

Redeploy after adding `SUPABASE_SERVICE_ROLE_KEY` if it was missing.

## 2. Run SQL lockdown in Supabase

In **Supabase → SQL Editor**, run the full script:

**`patch_security_lockdown.sql`**

This will:

- Enable **RLS** (and `FORCE ROW LEVEL SECURITY`) on every `public` table
- Drop all existing RLS policies (including permissive `USING (true)`)
- **Revoke** all table/sequence/function access from `anon` and `authenticated`
- **Grant** full access to `service_role` (used by API routes only)
- Lock storage buckets (`product_images`, `product-listing-images`, `qr-attachments`, etc.)

Run this **after** other feature SQL patches, or re-run if you add new tables later (the script is idempotent for existing tables).

## 3. Verify lockdown

1. **Supabase dashboard → Database → Linter** — critical RLS alerts should clear within a few minutes.
2. **Unauthenticated REST test** (replace URL and anon key):

```bash
curl "https://YOUR_PROJECT.supabase.co/rest/v1/profiles?select=*" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Expected: empty result or permission error — **not** profile rows.

3. **Portal login** — sign in and confirm dashboard, operations, finance, product listing, and product availability still work (they use `/api/*` with session).
4. **Logged-out** — visiting `/dashboard` redirects to login; `/api/operations/inventory` returns 401.

## 4. App-side protections (already in codebase)

- **`middleware.ts`** — requires `portal_session` for `/dashboard/*` and most `/api/*`
- **`src/lib/supabaseClient.ts`** — throws if `createSupabaseClient()` is called in the browser
- **Client pages** — product listing, product availability, QR uploads use authenticated API routes and `/api/upload/storage`
- **Debug routes** — `/api/check-setup`, `/api/debug-qr`, `/api/test-notifications` blocked in production

## 5. If something breaks after lockdown

- **401 on API calls** — user not logged in; check cookie / login flow.
- **500 “SUPABASE_SERVICE_ROLE_KEY is not configured”** — add env var and redeploy.
- **Upload failures** — uploads must go through `/api/upload/storage` (not direct `supabase.storage` from browser).
- **New table added** — re-run `patch_security_lockdown.sql` to enable RLS and revoke anon on new tables.

## Optional hardening (future)

- Sign or encrypt `portal_session` cookie (currently unsigned JSON).
- Rotate Supabase anon key after lockdown (old key still useless without grants).
- Add rate limiting on login API routes.
