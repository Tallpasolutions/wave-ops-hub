'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const createTechnicianSchema = z.object({
  nomeCompleto: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('E-mail inválido'),
  cpf: z.string().max(14).optional().or(z.literal('')),
  celular: z.string().max(20).optional().or(z.literal('')),
  codigoUnetvale: z.string().max(50).optional().or(z.literal('')),
})

export async function createTechnician(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const currentUser = await requireRole(['tenant_owner', 'tenant_manager'])

  const result = createTechnicianSchema.safeParse({
    nomeCompleto: formData.get('nomeCompleto'),
    email: formData.get('email'),
    cpf: formData.get('cpf') ?? '',
    celular: formData.get('celular') ?? '',
    codigoUnetvale: formData.get('codigoUnetvale') ?? '',
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { nomeCompleto, email, cpf, celular, codigoUnetvale } = result.data
  const tenantId = currentUser.tenantId!

  const supabase = await createSupabaseServerClient()
  const { error: dbError } = await supabase.from('technicians').insert({
    tenant_id: tenantId,
    nome_completo: nomeCompleto,
    email,
    cpf: cpf || null,
    celular: celular || null,
    codigo_unetvale: codigoUnetvale || null,
    ativo: true,
  })

  if (dbError) {
    if (dbError.code === '23505') {
      if (dbError.message?.includes('email')) return { error: 'Já existe um técnico com esse e-mail.' }
      if (dbError.message?.includes('cpf')) return { error: 'Já existe um técnico com esse CPF.' }
      if (dbError.message?.includes('codigo')) return { error: 'Já existe um técnico com esse código Unetvale.' }
      return { error: 'Dados duplicados. Verifique e-mail, CPF ou código Unetvale.' }
    }
    return { error: 'Erro ao cadastrar técnico. Tente novamente.' }
  }

  const from = formData.get('from') as string | null
  redirect(from && from.startsWith('/') ? from : '/equipe/tecnicos')
}

export async function toggleTechnicianAtivo(id: string, ativo: boolean): Promise<void> {
  await requireRole(['tenant_owner', 'tenant_manager'])

  const supabase = await createSupabaseServerClient()
  await supabase.from('technicians').update({ ativo }).eq('id', id)

  revalidatePath('/equipe/tecnicos')
}
