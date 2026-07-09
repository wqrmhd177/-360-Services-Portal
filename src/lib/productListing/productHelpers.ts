import { createSupabaseClient } from '@/lib/supabaseClient'
import type { PlGroupedProduct, PlProductRow, PlProductVariantRow, PlVariantInfo } from './types'

function getClient() {
  return createSupabaseClient()
}

/** Extract image URLs from a JSONB image field (string | string[] | null). */
export function extractImages(image: string | string[] | null | undefined): string[] {
  if (!image) return []
  if (Array.isArray(image)) return image.filter(Boolean) as string[]
  if (typeof image === 'string') {
    try {
      const parsed = JSON.parse(image)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
      return [image]
    } catch {
      return [image]
    }
  }
  return []
}

/** Get the first thumbnail for a grouped product. */
export function getProductThumbnail(product: PlGroupedProduct): string | undefined {
  const main = extractImages(product.image)
  if (main.length > 0) return main[0]
  for (const v of product.variants) {
    const imgs = extractImages(v.image ?? null)
    if (imgs.length > 0) return imgs[0]
  }
  return undefined
}

/** Group flat pl_products rows by product_id. */
export function groupProductRows(rows: PlProductRow[]): PlGroupedProduct[] {
  const map = new Map<number, PlGroupedProduct>()
  rows.forEach((r) => {
    if (!map.has(r.product_id)) {
      map.set(r.product_id, {
        product_id: r.product_id,
        product_title: r.product_title,
        image: r.image,
        fk_owned_by: r.fk_owned_by,
        brand_name: r.brand_name,
        material: r.material,
        bar_code: r.bar_code,
        has_variants: r.has_variants,
        options: r.options,
        status: r.status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        variants: [],
      })
    }
  })
  return Array.from(map.values())
}

/**
 * Fetch all products with their variants.
 * Merges pl_products headers with pl_product_variants rows.
 */
export async function fetchProductsWithVariants(filters?: {
  ownerId?: string
  status?: string
}): Promise<PlGroupedProduct[]> {
  const supabase = getClient()

  let query = supabase
    .from('pl_products')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.ownerId) query = query.eq('fk_owned_by', filters.ownerId)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data: productsData, error: productsError } = await query

  if (productsError) {
    console.error('Error fetching pl_products:', productsError)
    return []
  }
  if (!productsData || productsData.length === 0) return []

  const productIds = (productsData as PlProductRow[]).map((p) => p.product_id)

  const { data: variantsData } = await supabase
    .from('pl_product_variants')
    .select('*')
    .in('product_id', productIds)

  const variantMap = new Map<number, PlVariantInfo[]>()
  ;(variantsData as PlProductVariantRow[] || []).forEach((v) => {
    if (!variantMap.has(v.product_id)) variantMap.set(v.product_id, [])
    variantMap.get(v.product_id)!.push({
      variant_id: v.variant_id,
      option_values: v.option_values,
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      image: v.image,
      active: v.active,
    })
  })

  return (productsData as PlProductRow[]).map((p) => ({
    product_id: p.product_id,
    product_title: p.product_title,
    image: p.image,
    fk_owned_by: p.fk_owned_by,
    brand_name: p.brand_name,
    material: p.material,
    bar_code: p.bar_code,
    has_variants: p.has_variants,
    options: p.options,
    status: p.status,
    created_at: p.created_at,
    updated_at: p.updated_at,
    variants: variantMap.get(p.product_id) || [],
  }))
}

/** Generate next product_id (max existing + 1). */
export async function generateProductId(): Promise<number> {
  const supabase = getClient()
  const { data } = await supabase
    .from('pl_products')
    .select('product_id')
    .order('product_id', { ascending: false })
    .limit(1)
  const max = data?.[0]?.product_id ?? 0
  return max + 1
}

/** Delete a product and all its variants. Returns true on success. */
export async function deleteProduct(productId: number): Promise<boolean> {
  const supabase = getClient()
  const { error: varErr } = await supabase
    .from('pl_product_variants')
    .delete()
    .eq('product_id', productId)
  if (varErr) {
    console.error('Error deleting product variants:', varErr)
    return false
  }
  const { error: prodErr } = await supabase
    .from('pl_products')
    .delete()
    .eq('product_id', productId)
  if (prodErr) {
    console.error('Error deleting product:', prodErr)
    return false
  }
  return true
}

/** Update product status directly. */
export async function updateProductStatus(
  productId: number,
  status: 'pending' | 'active' | 'inactive' | 'rejected'
): Promise<boolean> {
  const supabase = getClient()
  const { error } = await supabase
    .from('pl_products')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('product_id', productId)
  return !error
}

/** Get pending product count (distinct product_ids with status='pending'). */
export async function getPendingProductsCount(): Promise<number> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('pl_products')
    .select('product_id')
    .eq('status', 'pending')
  if (error) return 0
  const distinct = new Set((data || []).map((r: { product_id: number }) => r.product_id))
  return distinct.size
}

export const VARIANT_DIMENSION_ORDER = [
  'Battery Capacity',
  'Charger Type',
  'Material',
  'Sizes',
  'Bundle',
  'Weight',
  'Power Output',
  'Pack SIZE',
  'Color',
  'Flavours',
]

export function sortVariantOptionNames(optionNames: string[]): string[] {
  return [...optionNames].sort((a, b) => {
    const aIdx = VARIANT_DIMENSION_ORDER.indexOf(a)
    const bIdx = VARIANT_DIMENSION_ORDER.indexOf(b)
    const aOrder = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx
    const bOrder = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.localeCompare(b)
  })
}

export function formatVariantLabel(
  optionValues?: Record<string, string> | null,
): string {
  if (optionValues && Object.keys(optionValues).length > 0) {
    const parts = sortVariantOptionNames(Object.keys(optionValues))
      .map((key) => optionValues[key])
      .filter(Boolean)
    if (parts.length > 0) return parts.join(' / ')
  }
  return 'Default'
}
