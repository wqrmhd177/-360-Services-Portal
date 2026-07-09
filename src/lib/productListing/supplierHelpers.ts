import { createSupabaseClient } from '@/lib/supabaseClient'
import type { PlSupplier } from './types'

function getClient() {
  return createSupabaseClient()
}

/** Generate a new supplier code like SUP001, SUP002, … */
export async function generateSupplierCode(): Promise<string> {
  const supabase = getClient()
  const { data } = await supabase
    .from('pl_suppliers')
    .select('supplier_code')
    .order('created_at', { ascending: false })
    .limit(100)

  const codes = (data || []).map((r: { supplier_code: string }) => r.supplier_code)
  let max = 0
  codes.forEach((c) => {
    const match = c.match(/^SUP(\d+)$/)
    if (match) max = Math.max(max, parseInt(match[1], 10))
  })
  return `SUP${String(max + 1).padStart(3, '0')}`
}

/** Fetch all non-archived suppliers, ordered by most recent. */
export async function fetchAllSuppliers(): Promise<PlSupplier[]> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('pl_suppliers')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching suppliers:', error)
    return []
  }
  return (data || []) as PlSupplier[]
}

/** Fetch a single supplier by code. */
export async function fetchSupplierByCode(code: string): Promise<PlSupplier | null> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('pl_suppliers')
    .select('*')
    .eq('supplier_code', code)
    .single()

  if (error || !data) return null
  return data as PlSupplier
}

/** Count distinct products owned by a supplier. */
export async function getProductCountForSupplier(supplierCode: string): Promise<number> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('pl_products')
    .select('product_id')
    .eq('fk_owned_by', supplierCode)

  if (error) return 0
  const distinct = new Set((data || []).map((r: { product_id: number }) => r.product_id))
  return distinct.size
}

/** Create a new supplier. Returns the created row or null on failure. */
export async function createSupplier(
  payload: Omit<PlSupplier, 'id' | 'created_at' | 'updated_at'>
): Promise<PlSupplier | null> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('pl_suppliers')
    .insert([payload])
    .select()
    .single()

  if (error) {
    console.error('Error creating supplier:', error)
    return null
  }
  return data as PlSupplier
}

/** Update supplier status (pending / approved / rejected). */
export async function updateSupplierStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected'
): Promise<boolean> {
  const supabase = getClient()
  const { error } = await supabase
    .from('pl_suppliers')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}
