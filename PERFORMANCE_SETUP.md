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
5. **`patch_orders_rollup_summary_rpc.sql`** — SQL aggregation for SLA, delivery partner, revenue loss (fixes slow filter changes)
   - Adds `ops_orders_order_detail` and `ops_orders_product_rollup` MVs
   - Adds `get_ops_store_visibility_tables` and `get_ops_orders_status_detail` RPCs
   - Updates `refresh_ops_orders_summaries_simple()` to refresh the new MVs

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

Optional: `DATABASE_URL` (Postgres session pooler URI) makes sync faster.

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
