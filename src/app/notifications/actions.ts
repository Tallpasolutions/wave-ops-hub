'use server'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function markNotificationRead(notifId: string) {
  const user = await getCurrentUser()
  if (!user) return

  const supabase = await createSupabaseServerClient()
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notifId)
    .eq('user_id', user.id)

  revalidatePath('/', 'layout')
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser()
  if (!user) return

  const supabase = await createSupabaseServerClient()
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  revalidatePath('/', 'layout')
}
