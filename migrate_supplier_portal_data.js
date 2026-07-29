/**
 * migrate_supplier_portal_data.js
 *
 * Migrates data from the Supplier Portal Supabase project into the
 * 360-Portal Supabase project (pl_* tables).
 *
 * Run:  node migrate_supplier_portal_data.js
 *
 * Requirements:
 *   npm install @supabase/supabase-js
 *
 * What is migrated:
 *   users (role=supplier) → pl_suppliers
 *   products              → pl_products  (one row per product_id)
 *   product_variants      → pl_product_variants
 *   price_history         → pl_price_history
 *   variant_status_change_requests → pl_variant_status_change_requests
 *
 * Image files stay where they are — URLs remain valid because the
 * Supplier Portal bucket is public.
 */

const { createClient } = require('@supabase/supabase-js')

// ── Supplier Portal (source) ──────────────────────────────────────────────────
const SRC_URL  = 'https://puoedxxoxyrdlesdghyp.supabase.co'
const SRC_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1b2VkeHhveHlyZGxlc2RnaHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NzI3NTksImV4cCI6MjA4NzE0ODc1OX0.oZEZjOLwzk4UBMpuGFyQVm3njX4zFH5sEA8WgXiC-tw'

// ── 360-Portal (destination) ─────────────────────────────────────────────────
const DST_URL  = 'https://uengcejyjagdcqecnlkr.supabase.co'
const DST_KEY  = 'sb_publishable_vmsFkQZ6ckzAJOFRU6l5aA_xLim9H43'

const src = createClient(SRC_URL, SRC_KEY)
const dst = createClient(DST_URL, DST_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────
const BATCH = 100

async function insertBatched(table, rows, conflictCol = 'id') {
  if (!rows.length) return 0
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const { error } = await dst.from(table).upsert(slice, { onConflict: conflictCol })
    if (error) {
      console.error(`  ✗ Error inserting batch into ${table} (offset ${i}):`, error.message)
    } else {
      inserted += slice.length
    }
  }
  return inserted
}

function normaliseApproval(val) {
  if (!val) return 'pending'
  const v = val.toLowerCase()
  if (v === 'approved') return 'approved'
  if (v === 'rejected') return 'rejected'
  return 'pending'
}

function normaliseProductStatus(val) {
  const allowed = ['pending', 'active', 'inactive', 'rejected']
  return allowed.includes(val) ? val : 'pending'
}

// ── 1. Migrate suppliers ──────────────────────────────────────────────────────
async function migrateSuppliers() {
  console.log('\n[1/5] Migrating suppliers…')

  const { data, error } = await src
    .from('users')
    .select('*')
    .eq('role', 'supplier')
    .eq('archived', false)

  if (error) { console.error('  ✗ Failed to fetch suppliers:', error.message); return }
  if (!data || !data.length) { console.log('  ℹ No suppliers found.'); return }

  console.log(`  → Found ${data.length} supplier(s)`)

  const rows = data.map(u => ({
    // Do NOT copy id — pl_suppliers.id is UUID, source users.id is integer.
    // supplier_code is the natural key used throughout the app.
    supplier_code: u.user_id,               // e.g. SUP001
    shop_name: u.shop_name_on_zambeel || u.store_name || u.owner_name || u.email || 'Unknown',
    owner_name: u.owner_name || null,
    email: u.email || null,
    phone: u.phone_number || null,
    whatsapp: u.whatsapp_phone_number || null,
    country: u.country || u.stock_location_country || null,
    city: u.city || null,
    currency: u.currency || 'USD',
    supplier_type: u.supplier_type || null,
    category: u.category || null,
    pickup_address: u.pickup_address || null,
    pickup_city: u.pickup_city || null,
    return_address: u.return_address || null,
    return_city: u.return_city || null,
    payment_method: u.payment_method || null,
    bank_title: u.bank_title || null,
    bank_name: u.bank_name || null,
    bank_country: u.bank_country || null,
    iban: u.iban || null,
    bank_account_number: u.bank_account_number || null,
    bank_account_title: u.bank_account_title || null,
    paypal_email: u.paypal_email || null,
    paypal_account_name: u.paypal_account_name || null,
    exchange_name: u.exchange_name || null,
    exchange_account_name: u.exchange_account_name || null,
    exchange_id: u.exchange_id || null,
    exchange_country: u.exchange_country || null,
    binance_wallet: u.binance_wallet || null,
    status: normaliseApproval(u.account_approval),
    archived: u.archived || false,
    created_by: null,
    created_at: u.created_at || new Date().toISOString(),
    updated_at: u.updated_at || new Date().toISOString(),
  }))

  const inserted = await insertBatched('pl_suppliers', rows, 'supplier_code')
  console.log(`  ✓ ${inserted} supplier(s) inserted/updated`)
}

// ── 2. Migrate products ───────────────────────────────────────────────────────
async function migrateProducts() {
  console.log('\n[2/5] Migrating products…')

  const { data, error } = await src
    .from('products')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) { console.error('  ✗ Failed to fetch products:', error.message); return }
  if (!data || !data.length) { console.log('  ℹ No products found.'); return }

  console.log(`  → Found ${data.length} product row(s)`)

  // Group by product_id — keep the first (oldest) row as the header
  const seen = new Map()
  for (const row of data) {
    if (!seen.has(row.product_id)) seen.set(row.product_id, row)
  }

  const rows = Array.from(seen.values()).map(p => ({
    product_id: p.product_id,
    product_title: p.product_title,
    fk_owned_by: p.fk_owned_by,
    image: p.image || null,
    brand_name: p.brand_name || null,
    material: p.material || null,
    package_includes: p.package_includes || null,
    description: p.description || null,
    category: p.category || null,
    bar_code: p.bar_code || null,
    has_variants: p.has_variants || false,
    options: p.options || null,
    status: normaliseProductStatus(p.status),
    created_at: p.created_at || new Date().toISOString(),
    updated_at: p.updated_at || new Date().toISOString(),
  }))

  // pl_products: upsert on product_id (unique constraint added by setup_product_listing_patch.sql)
  const inserted = await insertBatched('pl_products', rows, 'product_id')
  console.log(`  ✓ ${inserted} product(s) inserted/updated`)
}

// ── 3. Migrate product variants ───────────────────────────────────────────────
async function migrateProductVariants() {
  console.log('\n[3/5] Migrating product variants…')

  const { data, error } = await src
    .from('product_variants')
    .select('*')

  if (error) { console.error('  ✗ Failed to fetch product_variants:', error.message); return }
  if (!data || !data.length) {
    console.log('  ℹ No product_variants found — migrating legacy variants from products table…')
    await migrateLegacyVariants()
    return
  }

  console.log(`  → Found ${data.length} variant row(s)`)

  const rows = data.map(v => ({
    variant_id: v.variant_id,
    product_id: v.product_id,
    option_values: v.option_values || null,
    option_values_abbrev: v.option_values_abbrev || null,
    sku: v.sku || null,
    price: v.price || 0,
    stock: v.stock || 0,
    image: v.image || null,
    active: v.active !== false,
    created_at: v.created_at || new Date().toISOString(),
    updated_at: v.updated_at || new Date().toISOString(),
  }))

  const inserted = await insertBatched('pl_product_variants', rows, 'variant_id')
  console.log(`  ✓ ${inserted} variant(s) inserted/updated`)

  // Also handle legacy products that have no product_variants rows
  await migrateLegacyVariants(data.map(v => v.product_id))
}

async function migrateLegacyVariants(coveredProductIds = []) {
  // Products with has_variants = false have their variant data in the products table itself
  const { data, error } = await src
    .from('products')
    .select('*')
    .order('created_at', { ascending: true })

  if (error || !data) return

  const covered = new Set(coveredProductIds)
  const legacyRows = data.filter(p => !covered.has(p.product_id) && p.variant_id != null)

  if (!legacyRows.length) {
    console.log('  ℹ No legacy variants to migrate.')
    return
  }

  console.log(`  → Found ${legacyRows.length} legacy variant row(s)`)

  const rows = legacyRows.map(p => {
    const opts = {}
    if (p.color) opts['Color'] = p.color
    if (p.size) opts['Sizes'] = p.size

    return {
      variant_id: p.variant_id,
      product_id: p.product_id,
      option_values: Object.keys(opts).length > 0 ? opts : null,
      option_values_abbrev: null,
      sku: p.company_sku || null,
      price: p.variant_selling_price || 0,
      stock: p.variant_stock || 0,
      image: null,
      active: p.active !== false && p.status !== 'inactive',
      created_at: p.created_at || new Date().toISOString(),
      updated_at: p.updated_at || new Date().toISOString(),
    }
  })

  const insertedLegacy = await insertBatched('pl_product_variants', rows, 'variant_id')
  console.log(`  ✓ ${insertedLegacy} legacy variant(s) inserted/updated`)
}

// ── 4. Migrate price history ──────────────────────────────────────────────────
async function migratePriceHistory() {
  console.log('\n[4/5] Migrating price history…')

  const { data, error } = await src
    .from('price_history')
    .select('*')

  if (error) { console.error('  ✗ Failed to fetch price_history:', error.message); return }
  if (!data || !data.length) { console.log('  ℹ No price history found.'); return }

  console.log(`  → Found ${data.length} price history row(s)`)

  const rows = data.map(r => ({
    id: r.id,
    product_id: r.product_id,
    variant_id: r.variant_id,
    previous_price: r.previous_price,
    updated_price: r.updated_price,
    status: ['pending','approved','rejected'].includes(r.status) ? r.status : 'pending',
    reviewed_at: r.reviewed_at || null,
    reviewed_by: r.reviewed_by || null,
    notes: r.notes || null,
    created_by: r.created_by_supplier_id || null,
    created_at: r.created_at || new Date().toISOString(),
  }))

  const inserted = await insertBatched('pl_price_history', rows)
  console.log(`  ✓ ${inserted} price history row(s) inserted/updated`)
}

// ── 5. Migrate variant status change requests ─────────────────────────────────
async function migrateStatusChangeRequests() {
  console.log('\n[5/5] Migrating variant status change requests…')

  const { data, error } = await src
    .from('variant_status_change_requests')
    .select('*')

  if (error) { console.error('  ✗ Failed to fetch variant_status_change_requests:', error.message); return }
  if (!data || !data.length) { console.log('  ℹ No status change requests found.'); return }

  console.log(`  → Found ${data.length} status change request(s)`)

  const rows = data.map(r => ({
    id: r.id,
    product_id: r.product_id,
    variant_id: r.variant_id,
    request_scope: r.request_scope || 'variant',
    previous_active: r.previous_active,
    updated_active: r.updated_active,
    status: ['pending','approved','rejected'].includes(r.status) ? r.status : 'pending',
    reviewed_at: r.reviewed_at || null,
    reviewed_by: r.reviewed_by || null,
    created_by: r.created_by_supplier_id || null,
    created_at: r.created_at || new Date().toISOString(),
  }))

  const inserted = await insertBatched('pl_variant_status_change_requests', rows)
  console.log(`  ✓ ${inserted} status change request(s) inserted/updated`)
}

// ── Pre-flight check ──────────────────────────────────────────────────────────
async function preflight() {
  console.log('\n  Running pre-flight checks…')

  // 1. Can we read from source?
  const { error: srcErr } = await src.from('users').select('id').eq('role', 'supplier').limit(1)
  if (srcErr) {
    console.error(`\n  ✗ Cannot read from Supplier Portal: ${srcErr.message}`)
    console.error('    Check that SRC_URL and SRC_KEY are correct.')
    process.exit(1)
  }
  console.log('  ✓ Source (Supplier Portal) is reachable')

  // 2. Can we write to destination pl_suppliers?
  const { error: rls } = await dst
    .from('pl_suppliers')
    .insert([{ supplier_code: '__preflight__', shop_name: 'preflight', status: 'pending', archived: false, currency: 'USD' }])

  if (rls) {
    if (rls.message.includes('row-level security') || rls.message.includes('RLS')) {
      console.error('\n  ✗ RLS is blocking inserts on pl_suppliers.')
      console.error('\n  REQUIRED: Run setup_product_listing_patch.sql in the 360-Portal')
      console.error('  Supabase SQL editor BEFORE running this script.')
      console.error('  File: setup_product_listing_patch.sql (in the 360-Portal root)')
      console.error('\n  Steps:')
      console.error('    1. Go to https://supabase.com → your 360-Portal project')
      console.error('    2. Open SQL Editor')
      console.error('    3. Paste & run the contents of setup_product_listing_patch.sql')
      console.error('    4. Then re-run: node migrate_supplier_portal_data.js')
    } else if (rls.message.includes('unique') || rls.message.includes('duplicate')) {
      console.log('  ✓ Destination pl_suppliers is writable (preflight row exists)')
    } else {
      console.error(`\n  ✗ Cannot write to pl_suppliers: ${rls.message}`)
      process.exit(1)
    }
    if (rls.message.includes('row-level security') || rls.message.includes('RLS')) process.exit(1)
  } else {
    // Clean up preflight row
    await dst.from('pl_suppliers').delete().eq('supplier_code', '__preflight__')
    console.log('  ✓ Destination (360-Portal) is writable')
  }

  // 3. Check unique constraint on pl_products.product_id
  const { error: uniqueErr } = await dst
    .from('pl_products')
    .upsert([{ product_id: -9999999, product_title: '__preflight__', fk_owned_by: '__preflight__', has_variants: false, status: 'pending' }], { onConflict: 'product_id' })
  if (uniqueErr && uniqueErr.message.includes('unique or exclusion constraint')) {
    console.error('\n  ✗ pl_products is missing unique constraint on product_id.')
    console.error('  Run setup_product_listing_patch.sql to add it.')
    process.exit(1)
  }
  await dst.from('pl_products').delete().eq('product_id', -9999999)
  console.log('  ✓ pl_products unique constraint on product_id is present')

  console.log('  ✓ All pre-flight checks passed\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60))
  console.log('  Supplier Portal → 360-Portal Data Migration')
  console.log('='.repeat(60))
  console.log(`  Source:      ${SRC_URL}`)
  console.log(`  Destination: ${DST_URL}`)

  await preflight()
  await migrateSuppliers()
  await migrateProducts()
  await migrateProductVariants()
  await migratePriceHistory()
  await migrateStatusChangeRequests()

  console.log('\n' + '='.repeat(60))
  console.log('  Migration complete!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('\n✗ Fatal error:', err)
  process.exit(1)
})
