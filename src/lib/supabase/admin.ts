import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Bypassa RLS — APENAS em Server Actions administrativas explícitas.
// Usado para: criar usuários via convite (auth.users), reprocessamento administrativo, seeds.
// O import 'server-only' acima garante erro de build se qualquer Client Component tentar importar.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
