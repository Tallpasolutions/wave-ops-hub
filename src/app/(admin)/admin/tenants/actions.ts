'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const tenantSchema = z.object({
  slug: z
    .string()
    .regex(
      /^[a-z0-9-]{2,32}$/,
      'Slug inválido: use apenas letras minúsculas, números e hífens (2–32 caracteres)',
    ),
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  plano: z.enum(['starter', 'standard', 'premium'], {
    errorMap: () => ({ message: 'Selecione um plano válido' }),
  }),
})

export async function createTenant(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireRole(['tallpa_owner'])

  const result = tenantSchema.safeParse({
    slug: formData.get('slug'),
    nome: formData.get('nome'),
    plano: formData.get('plano'),
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { slug, nome, plano } = result.data

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('tenants').insert({
    slug,
    nome,
    plano,
    brand_path: slug,
    ativo: true,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Esse slug já está em uso.' }
    return { error: 'Erro ao criar tenant. Tente novamente.' }
  }

  redirect('/admin/tenants')
}

export async function toggleTenantAtivo(id: string, ativo: boolean): Promise<void> {
  await requireRole(['tallpa_owner'])

  const supabase = await createSupabaseServerClient()
  await supabase.from('tenants').update({ ativo }).eq('id', id)

  revalidatePath('/admin/tenants')
  revalidatePath('/admin/dashboard')
}
