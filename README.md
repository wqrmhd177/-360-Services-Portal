# 360 Procurement Portal

Internal procurement portal built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase** (Postgres + Auth + Storage).

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Create an `.env.local` file based on `.env.local.example` and paste your Supabase details:

```bash
cp .env.local.example .env.local
```

Set:

- `NEXT_PUBLIC_SUPABASE_URL` to your Supabase URL  
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your anon API key

3. Run the dev server:

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Auth

- `/` and `/auth/login` provide Google sign-in via Supabase.
- On auth callback, the app redirects to `/dashboard`, which will route users into role-based workspaces (Growth, Approver, Procurement, Finance) as you connect it to your Supabase schema and RLS policies.

