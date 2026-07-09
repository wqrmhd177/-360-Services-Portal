import { createSupabaseClient } from '@/lib/supabaseClient'
import type { PlPriceHistoryEntry } from './types'

function getClient() {
  return createSupabaseClient()
}

/** Create a pending price change request. Returns null if prices are equal. */
export async function createPriceHistoryEntry(
  productId: number,
  variantId: number,
  previousPrice: number,
  updatedPrice: number,
  createdBy: string
): Promise<PlPriceHistoryEntry | null> {
  const prev = Number(previousPrice)
  const upd = Number(updatedPrice)
  if (Number.isNaN(prev) || Number.isNaN(upd) || prev === upd) return null

  const supabase = getClient()
  const { data, error } = await supabase
    .from('pl_price_history')
    .insert([{
      product_id: productId,
      variant_id: variantId,
      previous_price: prev,
      updated_price: upd,
      status: 'pending',
      created_by: createdBy,
      created_at: new Date().toISOString(),
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating price history entry:', error)
    return null
  }
  return data as PlPriceHistoryEntry
}

/** Fetch price requests by status. Includes product title lookup. */
export async function fetchPriceRequestsByStatus(
  status: 'pending' | 'approved' | 'rejected' | 'all'
): Promise<Array<PlPriceHistoryEntry & { product_title?: string }>> {
  const supabase = getClient()
  let query = supabase.from('pl_price_history').select('*')
  if (status !== 'all') query = query.eq('status', status)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) {
    console.error('Error fetching price requests:', error)
    return []
  }
  if (!data || data.length === 0) return []

  const productIds = Array.from(new Set((data as PlPriceHistoryEntry[]).map((r) => r.product_id)))
  const { data: products } = await supabase
    .from('pl_products')
    .select('product_id, product_title')
    .in('product_id', productIds)

  const titleMap = new Map((products || []).map((p: { product_id: number; product_title: string }) => [p.product_id, p.product_title]))

  return (data as PlPriceHistoryEntry[]).map((r) => ({
    ...r,
    product_title: titleMap.get(r.product_id),
  }))
}

/** Approve a price change: update variant price + mark approved. */
export async function approvePriceChange(
  priceHistoryId: string,
  reviewedBy: string
): Promise<boolean> {
  const supabase = getClient()
  const { data: entry, error: fetchErr } = await supabase
    .from('pl_price_history')
    .select('*')
    .eq('id', priceHistoryId)
    .single()

  if (fetchErr || !entry) return false

  const now = new Date().toISOString()
  await supabase
    .from('pl_product_variants')
    .update({ price: entry.updated_price, updated_at: now })
    .eq('variant_id', entry.variant_id)

  const { error: updErr } = await supabase
    .from('pl_price_history')
    .update({ status: 'approved', reviewed_at: now, reviewed_by: reviewedBy })
    .eq('id', priceHistoryId)

  return !updErr
}

/** Reject a price change request. */
export async function rejectPriceChange(
  priceHistoryId: string,
  reviewedBy: string
): Promise<boolean> {
  const supabase = getClient()
  const { error } = await supabase
    .from('pl_price_history')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
    })
    .eq('id', priceHistoryId)
  return !error
}

/** Count pending price change requests. */
export async function getPendingPriceRequestCount(): Promise<number> {
  const supabase = getClient()
  const { count, error } = await supabase
    .from('pl_price_history')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) return 0
  return count ?? 0
}
