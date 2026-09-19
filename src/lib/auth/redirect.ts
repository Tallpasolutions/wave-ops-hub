import type { AppRole } from './types'

export function buildPostLoginUrl(role: AppRole, subdomain: string): string {
  const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost'
  const isLocal = ROOT === 'localhost'
  const scheme = isLocal ? 'http' : 'https'
  const port = isLocal ? ':3000' : ''

  if (role === 'tallpa_owner') return `${scheme}://admin.${ROOT}${port}/admin/dashboard`
  // Supervisor mora no portal do TÉCNICO, não no do gestor: (manager)/layout.tsx recusa
  // tenant_supervisor e manda para /login. Sem esta linha ele caía no return genérico
  // abaixo, ia para /dashboard, era recusado e voltava para o login — laço infinito, e o
  // supervisor nunca entrava. O papel nasceu na 0009 e esta função nunca foi atualizada.
  if (role === 'tenant_technician' || role === 'tenant_supervisor') {
    return `${scheme}://${subdomain}.${ROOT}${port}/profile`
  }
  return `${scheme}://${subdomain}.${ROOT}${port}/dashboard`
}
