import type { Page } from '@playwright/test'

type Role = 'admin' | 'manager' | 'technician'

// Base URLs por role — o middleware exige subdomínios explícitos
export const BASE_URLS: Record<Role, string> = {
  admin: 'http://admin.localhost:3000',
  manager: 'http://wave.localhost:3000',
  technician: 'http://wave.localhost:3000',
}

const CREDENTIALS: Record<Role, { email: string; password: string }> = {
  admin: {
    email: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '',
    password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? '',
  },
  manager: {
    email: process.env.PLAYWRIGHT_MANAGER_EMAIL ?? '',
    password: process.env.PLAYWRIGHT_MANAGER_PASSWORD ?? '',
  },
  technician: {
    email: process.env.PLAYWRIGHT_TECHNICIAN_EMAIL ?? '',
    password: process.env.PLAYWRIGHT_TECHNICIAN_PASSWORD ?? '',
  },
}

export async function loginAs(page: Page, role: Role): Promise<void> {
  const { email, password } = CREDENTIALS[role]
  if (!email || !password) {
    throw new Error(
      `Missing credentials for role "${role}". ` +
        `Set PLAYWRIGHT_${role.toUpperCase()}_EMAIL and ` +
        `PLAYWRIGHT_${role.toUpperCase()}_PASSWORD in .env.local`,
    )
  }

  const baseUrl = BASE_URLS[role]
  await page.goto(`${baseUrl}/login`)
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /entrar na plataforma/i }).click()
}
