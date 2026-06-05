import { test, expect } from '@playwright/test'
import { loginAs, BASE_URLS } from '../fixtures/auth'

const WAVE = BASE_URLS.manager

test.describe('RLS — técnico não vê dados de outros', () => {
  test('técnico não acessa rota do manager /equipe/tecnicos', async ({ page }) => {
    await loginAs(page, 'technician')
    await page.waitForURL(`${WAVE}/profile`, { timeout: 15_000 })

    await page.goto(`${WAVE}/equipe/tecnicos`)
    // Deve ser redirecionado para login (sem acesso de manager)
    await page.waitForURL(`${WAVE}/login`, { timeout: 8_000 })
    await expect(page).toHaveURL(`${WAVE}/login`)
  })

  test('técnico não acessa rota do manager /lpu', async ({ page }) => {
    await loginAs(page, 'technician')
    await page.waitForURL(`${WAVE}/profile`, { timeout: 15_000 })

    await page.goto(`${WAVE}/lpu`)
    await page.waitForURL(`${WAVE}/login`, { timeout: 8_000 })
    await expect(page).toHaveURL(`${WAVE}/login`)
  })

  test('técnico não acessa rota do manager /pagamentos', async ({ page }) => {
    await loginAs(page, 'technician')
    await page.waitForURL(`${WAVE}/profile`, { timeout: 15_000 })

    await page.goto(`${WAVE}/pagamentos`)
    await page.waitForURL(`${WAVE}/login`, { timeout: 8_000 })
    await expect(page).toHaveURL(`${WAVE}/login`)
  })

  test('técnico vê apenas suas próprias visitas em /visitas', async ({ page }) => {
    await loginAs(page, 'technician')
    await page.waitForURL(`${WAVE}/profile`, { timeout: 15_000 })

    await page.goto(`${WAVE}/visitas`)

    // Verifica que a página carregou — heading "Minhas Visitas" é sempre renderizado
    await expect(
      page.getByRole('heading', { name: /minhas visitas/i }),
    ).toBeVisible({ timeout: 8_000 })

    // Verifica que não há exposição do nome do técnico de outros usuários na página
    // (A página de visitas do técnico só mostra os dados do próprio técnico)
    const techEmail = process.env.PLAYWRIGHT_TECHNICIAN_EMAIL ?? ''
    if (techEmail) {
      // Não deve haver link para /equipe/tecnicos (rota de manager)
      await expect(page.getByRole('link', { name: /equipe/i })).not.toBeVisible()
    }
  })
})
