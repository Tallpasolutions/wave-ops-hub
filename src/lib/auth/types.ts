export type AppRole =
  | 'tallpa_owner'
  | 'tenant_owner'
  | 'tenant_manager'
  | 'tenant_technician'

// Claims customizadas que o Auth Hook injeta no JWT ao gerar o token
export interface AuthClaims {
  sub: string                    // auth.uid() — igual ao id em public.users
  email: string
  role: AppRole
  tenant_id: string | null       // null para tallpa_owner
  technician_id: string | null   // preenchido apenas para tenant_technician
  aud: string
  exp: number
}

// Representação do usuário logado em runtime (Server Components e Server Actions)
export interface SessionUser {
  id: string
  email: string
  role: AppRole
  tenantId: string | null
  technicianId: string | null
  nomeCompleto: string
  ativo: boolean
}
