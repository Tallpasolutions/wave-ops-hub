'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const updateProfileSchema = z.object({
  celular: z.string().max(20).optional(),
  observacoes: z.string().max(500).optional(),
})

export async function updateTechnicianProfile(
  _prevState: { error: string | null; success: boolean },
  formData: FormData,
) {
  const user = await getCurrentUser()
  if (!user?.technicianId) return { error: 'Não autorizado', success: false }

  const parsed = updateProfileSchema.safeParse({
    celular: formData.get('celular') as string,
    observacoes: formData.get('observacoes') as string,
  })
  if (!parsed.success) return { error: 'Dados inválidos', success: false }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('technicians')
    .update({
      celular: parsed.data.celular || null,
      observacoes: parsed.data.observacoes || null,
    })
    .eq('id', user.technicianId)

  if (error) return { error: 'Erro ao salvar dados. Tente novamente.', success: false }

  revalidatePath('/profile')
  return { error: null, success: true }
}

const changePasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

export async function changePassword(
  _prevState: { error: string | null; success: boolean },
  formData: FormData,
) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Não autorizado', success: false }

  const parsed = changePasswordSchema.safeParse({
    newPassword: formData.get('newPassword') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  })
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Dados inválidos', success: false }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })

  if (error) return { error: 'Erro ao alterar senha. Tente novamente.', success: false }

  return { error: null, success: true }
}
