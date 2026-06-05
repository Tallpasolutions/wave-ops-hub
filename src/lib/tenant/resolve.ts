import { createClient } from '@supabase/supabase-js'

export interface TenantInfo {
  slug: string
  brand_path: string
  ativo: boolean
}

export async function resolveTenantFromSlug(slug: string): Promise<TenantInfo | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data, error } = await supabase
    .from('tenants')
    .select('slug, brand_path, ativo')
    .eq('slug', slug)
    .eq('ativo', true)
    .single()

  if (error || !data) return null
  return data as TenantInfo
}
