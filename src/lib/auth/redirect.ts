import type { AppRole } from './types'

export function buildPostLoginUrl(role: AppRole, subdomain: string): string {
  const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost'
  const isLocal = ROOT === 'localhost'
  const scheme = isLocal ? 'http' : 'https'
  const port = isLocal ? ':3000' : ''

  if (role === 'tallpa_owner') return `${scheme}://admin.${ROOT}${port}/admin/dashboard`
  if (role === 'tenant_technician') return `${scheme}://${subdomain}.${ROOT}${port}/profile`
  return `${scheme}://${subdomain}.${ROOT}${port}/dashboard`
}
