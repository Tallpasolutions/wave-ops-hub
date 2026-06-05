import { test, expect } from '@playwright/test'
import { loginAs, BASE_URLS } from '../fixtures/auth'

const ADMIN_BASE = BASE_URLS.admin
const WAVE_BASE = BASE_URLS.manager

test.describe('Proteção de rotas — sem autenticação', () => {
  test('admin/dashboard sem auth redireciona para /login', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/admin/dashboard`)
    await page.waitForURL(`${ADMIN_BASE}/login`, { timeout: 8_000 })
    await expect(page).toHaveURL(`${ADMIN_BASE}/login`)
  })

  test('dashboard sem auth redireciona para /login', async ({ page }) => {
    await page.goto(`${WAVE_BASE}/dashboard`)
    await page.waitForURL(`${WAVE_BASE}/login`, { timeout: 8_000 })
    await expect(page).toHaveURL(`${WAVE_BASE}/login`)
  })

  test('profile sem auth redireciona para /login', async ({ page }) => {
    await page.goto(`${WAVE_BASE}/profile`)
    await page.waitForURL(`${WAVE_BASE}/login`, { timeout: 8_000 })
    await expect(page).toHaveURL(`${WAVE_BASE}/login`)
  })
})

test.describe('Proteção de rotas — role errado', () => {
  test('manager não acessa /admin/dashboard', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE_BASE}/dashboard`, { timeout: 10_000 })

    // tenta navegar para o portal de admin (outro subdomain)
    await page.goto(`${ADMIN_BASE}/admin/dashboard`)
    await page.waitForURL(`${ADMIN_BASE}/login`, { timeout: 8_000 })
    await expect(page).toHaveURL(`${ADMIN_BASE}/login`)
  })
})
