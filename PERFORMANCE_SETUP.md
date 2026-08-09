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
11. **`patch_kpi_date_fixes.sql`** — corrects KPI aging dates (confirmation, approved, dispatching, shipped, undelivered) and adds the `confirmation_pending_date` column; also enables the new country/date split-panel drill-down
12. **`setup_nd_report.sql`** — ND Report FIFO allocation MVs, remarks table, and RPCs (requires step 9 for country normalization)
13. **`patch_nd_report_enhancements.sql`** — store-level ND remarks (Ops/Growth/Status), remark logs, fulfilment routes, bulk route upload, and updated ND summary MV
14. **`patch_kpi_drilldown_enhancements.sql`** — KPI drill-down bifurcation sidebar counts and User ID / SKU order grouping
15. **`patch_kpi_returning_status.sql`** — Orders in Returning card: `Return in Transit` only, aged from `final_action_date_undelivered` (rebuilds order-detail MVs + status drill-down RPC)
16. **`patch_nd_report_order_details.sql`** — ND stuck-order list with approved dates; inventory-aware FIFO allocation (country+SKU pool fallback). **Approved status only**; only excess quantity (above available stock) counts as ND.
17. **`patch_kpi_dispatching_shipment_date.sql`** — Dispatching KPI ages from `shipment_date_log`; drill-down day/country/total counts use unique `order_id` (no double-count for multi-SKU orders).
18. **`patch_security_lockdown.sql`** — RLS on all public tables; revoke anon/authenticated; service role only (see [SECURITY_SETUP.md](./SECURITY_SETUP.md)).
19. **`setup_movements.sql`** — `movement_requests` and `movement_request_logs` tables for the Zambeel 360 Movements module (isolated from QR/PR/PO). Run **after step 18** so RLS is applied consistently.
20. **`patch_nd_report_ux.sql`** — ND Report UX overhaul: inventory PO/Movement qty columns, rebuilt `ops_nd_sku_summary` MV (`min_nd_date`, `po_qty`, `movement_qty`), multi-select country/bifurcation filters, Undelivered/Returning qty in SKU details RPC. Run **after step 16**. Then refresh:

```sql
SELECT refresh_ops_orders_summaries_simple();
REFRESH MATERIALIZED VIEW ops_nd_allocations;
REFRESH MATERIALIZED VIEW ops_nd_sku_summary;
```

Re-run inventory sync after deploy so PO/Movement qty populate (Metabase must expose those fields when available).

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

## 18. Security lockdown (Supabase public access alerts)

If Supabase emails report **publicly accessible tables** or **RLS disabled**, follow **[SECURITY_SETUP.md](./SECURITY_SETUP.md)**:

1. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set on Vercel (server only).
2. Run **`patch_security_lockdown.sql`** in Supabase SQL Editor.
3. Redeploy the app and verify login + a few dashboard pages.
4. Confirm anon REST calls return no data (see SECURITY_SETUP.md).

## What changed in the app

- **Operations Orders, Store Visibility & SKU Performance**: server-rendered with Suspense; MV/RPC-backed data with `unstable_cache`
- **Status KPI drill-down**: SQL RPC instead of loading all line items into Node.js
- **Store Visibility tables**: SQL RPC from product rollup MV
- **After Sync Data / hourly sync**: cache invalidated via `/api/operations/revalidate`
- **Finance / Growth / Procurement dashboards**: SQL count RPCs instead of full-table JS filters
- **List APIs**: paginated (default 100 rows per page)
