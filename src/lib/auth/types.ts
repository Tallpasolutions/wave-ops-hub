export type AppRole =
  | 'tallpa_owner'
  | 'tenant_owner'
  | 'tenant_manager'
  | 'tenant_technician'
  | 'tenant_supervisor'

// Claims customizadas que o Auth Hook injeta no JWT ao gerar o token.
// Usamos 'app_role' (não 'role') porque 'role' é reservado pelo PostgREST
// para fazer SET ROLE no PostgreSQL — sobrescrever causaria "role does not exist".
export interface AuthClaims {
  sub: string                    // auth.uid() — igual ao id em public.users
  email: string
  app_role: AppRole
  tenant_id: string | null       // null para tallpa_owner
  technician_id: string | null   // preenchido para tenant_technician e tenant_supervisor
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
