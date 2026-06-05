import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth'
import { uniqueSlug, uniqueEmail } from '../fixtures/helpers'

const ADMIN = 'http://admin.localhost:3000'

test.describe('Onboarding — Tallpa cria tenant e owner', () => {
  let tenantSlug: string
  let tenantNome: string

  test.beforeAll(() => {
    tenantSlug = uniqueSlug()
    tenantNome = `E2E Tenant ${tenantSlug}`
  })

  test('cria novo tenant', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.waitForURL(`${ADMIN}/admin/dashboard`, { timeout: 15_000 })

    await page.goto(`${ADMIN}/admin/tenants/new`)
    await page.locator('#slug').fill(tenantSlug)
    await page.locator('#nome').fill(tenantNome)
    await page.getByRole('button', { name: /criar tenant/i }).click()

    await page.waitForURL(`${ADMIN}/admin/tenants`, { timeout: 10_000 })
    // Aguarda page content carregar depois do redirect
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(tenantNome)).toBeVisible({ timeout: 10_000 })
  })

  test('cria tenant_owner para o tenant criado', async ({ page }) => {
    const email = uniqueEmail('owner')
    const nome = `Owner E2E ${tenantSlug}`

    await loginAs(page, 'admin')
    await page.waitForURL(`${ADMIN}/admin/dashboard`, { timeout: 15_000 })

    await page.goto(`${ADMIN}/admin/users/new`)
    await page.locator('#nomeCompleto').fill(nome)
    await page.locator('#email').fill(email)

    // A role já inicia como "Proprietário" (tenant_owner) — select já visível
    // Clica no role combobox para garantir que Proprietário está selecionado
    await page.locator('button[role="combobox"]').first().click()
    await page.waitForSelector('[role="option"]', { timeout: 5_000 })
    await page.getByRole('option', { name: 'Proprietário' }).click()

    // Tenant select já está visível (needsTenant = true por padrão)
    await page.locator('button[role="combobox"]').nth(1).click()
    await page.waitForSelector('[role="option"]', { timeout: 5_000 })
    await page.getByRole('option', { name: new RegExp(tenantSlug, 'i') }).click()

    await page.locator('#senhaInicial').fill('Senha@E2E123')
    await page.getByRole('button', { name: /criar usuário/i }).click()

    await page.waitForURL(`${ADMIN}/admin/users`, { timeout: 10_000 })
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 })
  })
})
