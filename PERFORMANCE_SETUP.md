# Performance setup (manual steps)

After deploying the app code, complete these steps in order.

## 1. Run SQL patches in Supabase

Open the **Supabase SQL Editor** and run each file **in this order**:

1. **`patch_performance_orders_rpc.sql`**
   - Status counts read from `ops_orders_status_rollup` MV
   - Removes expensive `allCount` from `get_ops_orders_counts`
   - Adds indexes for inventory SKU match and SKU daily performance

2. **`patch_performance_sku_rpc.sql`**
   - Rewrites `get_ops_sku_performance_summary` to single-pass with `COUNT(*) OVER ()`

3. **`patch_workflow_counts.sql`**
   - Adds Finance / Growth / Procurement dashboard count RPCs

4. **`patch_store_visibility_status_detail.sql`**
5. **`patch_orders_rollup_summary_rpc.sql`**
6. **`patch_fix_refresh_summaries.sql`** — extends MV refresh timeout; required for hourly GitHub sync
7. **`patch_ops_mv_refresh_queue.sql`** — queues MV refresh inside Supabase (no GitHub DATABASE_URL needed)
8. **`patch_return_sla_final_action_date.sql`** — syncs return-request date; fixes Avg return request → returned KPI
9. **`patch_country_normalization.sql`** — clubs UAE/United Arab Emirates and KSA/Saudi Arabia in filters and KPIs
10. **`patch_delivery_partner_live_rpc.sql`** — delivery partner chart: Blank / Unknown / Unassigned labels using tracking id + courier name (re-run after deploy, then sync)

Then refresh materialized views once:

```sql
SELECT refresh_ops_orders_summaries_simple();
```

## 2. Deploy app code to Vercel

Push to `main`. Vercel deploys automatically from GitHub.

## 3. GitHub Actions secrets (for hourly sync + cache refresh)

In **GitHub → Settings → Secrets and variables → Actions**, ensure:

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `VERCEL_PRODUCTION_URL` | e.g. `https://360-portal-beige.vercel.app` |
| `CRON_SECRET` | Same value as Vercel env var `CRON_SECRET` |

**Easiest optional secret (faster sync):** `SUPABASE_DB_PASSWORD` — your Supabase **database password only** (not a URL).  
The sync script auto-builds the IPv4 pooler connection. You can **delete** the `DATABASE_URL` secret if you have one.

Optional: `SUPABASE_DB_REGION` if auto-detect is slow.

After patch 7, MV refresh runs inside Supabase even without `SUPABASE_DB_PASSWORD`.

## 4. Verify

1. **Operations → Orders** — KPI cards load in a few seconds; status drill-down opens quickly
2. **Operations → Store Visibility** — tables load quickly (no 30s wait)
3. **Operations → SKU Performance** — server-rendered table loads quickly
4. Change date range — refreshes quickly (cached until sync)
5. Click **Sync Data** on Orders — numbers update after completion
6. **Finance / Growth / Procurement** dashboards — KPI cards load quickly

If Finance/Growth/Procurement KPIs error, patch 3 was not applied.  
If Store Visibility or status drill-down error, patch 4 was not applied.

## What changed in the app

- **Operations Orders, Store Visibility & SKU Performance**: server-rendered with Suspense; MV/RPC-backed data with `unstable_cache`
- **Status KPI drill-down**: SQL RPC instead of loading all line items into Node.js
- **Store Visibility tables**: SQL RPC from product rollup MV
- **After Sync Data / hourly sync**: cache invalidated via `/api/operations/revalidate`
- **Finance / Growth / Procurement dashboards**: SQL count RPCs instead of full-table JS filters
- **List APIs**: paginated (default 100 rows per page)
