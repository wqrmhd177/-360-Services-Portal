import { createSupabaseClient } from '@/lib/supabaseClient'
import type { PlVariantStatusChangeRequest } from './types'

function getClient() {
  return createSupabaseClient()
}

/** Create a pending status change request. Returns null if no change. */
export async function createVariantStatusChangeRequest(
  productId: number,
  variantId: number,
  previousActive: boolean,
  updatedActive: boolean,
  createdBy: string,
  requestScope: 'variant' | 'product' = 'variant'
): Promise<PlVariantStatusChangeRequest | null> {
  if (previousActive === updatedActive) return null
  const supabase = getClient()
  const { data, error } = await supabase
    .from('pl_variant_status_change_requests')
    .insert([{
      product_id: productId,
      variant_id: variantId,
      request_scope: requestScope,
      previous_active: previousActive,
      updated_active: updatedActive,
      status: 'pending',
      created_by: createdBy,
      created_at: new Date().toISOString(),
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating status change request:', error)
    return null
  }
  return data as PlVariantStatusChangeRequest
}

/** Fetch status change requests by status. */
export async function fetchStatusRequestsByStatus(
  status: 'pending' | 'approved' | 'rejected' | 'all'
): Promise<PlVariantStatusChangeRequest[]> {
  const supabase = getClient()
  let query = supabase.from('pl_variant_status_change_requests').select('*')
  if (status !== 'all') query = query.eq('status', status)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) {
    console.error('Error fetching status change requests:', error)
    return []
  }
  return (data || []) as PlVariantStatusChangeRequest[]
}

/** Approve a status change: update variant active flag + product status. */
export async function approveStatusChangeRequest(
  requestId: string,
  reviewedBy: string
): Promise<boolean> {
  const supabase = getClient()
  const { data: req, error: fetchErr } = await supabase
    .from('pl_variant_status_change_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (fetchErr || !req) return false

  const isProductScope = req.request_scope === 'product'
  const now = new Date().toISOString()

  const pvQuery = supabase
    .from('pl_product_variants')
    .update({ active: req.updated_active, updated_at: now })
    .eq('product_id', req.product_id)

  await (isProductScope ? pvQuery : pvQuery.eq('variant_id', req.variant_id))

  if (isProductScope) {
    await supabase
      .from('pl_products')
      .update({
        status: req.updated_active ? 'active' : 'inactive',
        updated_at: now,
      })
      .eq('product_id', req.product_id)
  } else {
    const { data: variantRows } = await supabase
      .from('pl_product_variants')
      .select('active')
      .eq('product_id', req.product_id)
    const anyActive = (variantRows || []).some((v: { active: boolean }) => v.active !== false)
    await supabase
      .from('pl_products')
      .update({
        status: anyActive ? 'active' : 'inactive',
        updated_at: now,
      })
      .eq('product_id', req.product_id)
  }

  const { error: updErr } = await supabase
    .from('pl_variant_status_change_requests')
    .update({ status: 'approved', reviewed_at: now, reviewed_by: reviewedBy })
    .eq('id', requestId)

  return !updErr
}

/** Reject a status change request. */
export async function rejectStatusChangeRequest(
  requestId: string,
  reviewedBy: string
): Promise<boolean> {
  const supabase = getClient()
  const { error } = await supabase
    .from('pl_variant_status_change_requests')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
    })
    .eq('id', requestId)
  return !error
}

/** Count pending status change requests. */
export async function getPendingStatusChangeCount(): Promise<number> {
  const supabase = getClient()
  const { count, error } = await supabase
    .from('pl_variant_status_change_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) return 0
  return count ?? 0
}
