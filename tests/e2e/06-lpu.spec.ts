import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth'
import { BASE_URLS } from '../fixtures/helpers'

const WAVE = BASE_URLS.manager

test.describe('LPU — cadastro completo e ativação', () => {
  let lpuNome: string

  test.beforeAll(() => {
    lpuNome = `LPU E2E ${Date.now().toString(36)}`
  })

  test('cria LPU como rascunho', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    await page.goto(`${WAVE}/lpu/new`)
    await page.locator('#nome').fill(lpuNome)

    const hoje = new Date().toISOString().split('T')[0]
    await page.locator('#vigenciaInicio').fill(hoje)

    await page.getByRole('button', { name: /criar lpu/i }).click()

    await page.waitForURL(/\/lpu\/[^/]+$/, { timeout: 10_000 })
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(lpuNome)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/rascunho/i)).toBeVisible({ timeout: 5_000 })
  })

  test('adiciona regra à LPU', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    await page.goto(`${WAVE}/lpu`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: new RegExp(lpuNome, 'i') }).first().click()
    await page.waitForURL(/\/lpu\/[^/]+$/, { timeout: 8_000 })
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: /nova regra/i }).click()
    await page.waitForURL(/\/lpu\/.+\/rules\/new/, { timeout: 8_000 })

    // Condição: finalidade já está selecionada por padrão
    await page.getByPlaceholder(/valor exato/i).fill('Instalação')

    // Payout: "Valor fixo" já selecionado por padrão
    await page.getByPlaceholder('80.00').fill('150')

    await page.locator('#description').fill('Instalação Externo — Regra E2E')

    await page.getByRole('button', { name: /criar regra/i }).click()

    await page.waitForURL(/\/lpu\/[^/]+$/, { timeout: 10_000 })
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/instalação externo.*regra e2e/i)).toBeVisible({ timeout: 8_000 })
  })

  test('ativa a LPU e verifica badge Ativa', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    await page.goto(`${WAVE}/lpu`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('link', { name: new RegExp(lpuNome, 'i') }).first().click()
    await page.waitForURL(/\/lpu\/[^/]+$/, { timeout: 8_000 })
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /ativar esta lpu/i }).click()

    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/\bativa\b/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/rascunho/i)).not.toBeVisible({ timeout: 3_000 })
  })

  test('LPU ativa aparece em destaque na listagem', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    await page.goto(`${WAVE}/lpu`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(lpuNome)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/\bativa\b/i).first()).toBeVisible({ timeout: 3_000 })
  })
})
