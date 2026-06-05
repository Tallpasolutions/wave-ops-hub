import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth'
import { BASE_URLS } from '../fixtures/helpers'

const WAVE = BASE_URLS.manager

/**
 * Encontra o href do primeiro fechamento com o status indicado na página /fechamento.
 * Retorna null se não encontrar.
 */
async function findFechamentoPeriodo(page: import('@playwright/test').Page, statusText: RegExp) {
  await page.goto(`${WAVE}/fechamento`)
  const link = page.getByText(statusText).first()
  const visible = await link.isVisible({ timeout: 4_000 }).catch(() => false)
  if (!visible) return null

  // Sobe para o card pai e pega o href do link de navegação
  const card = link.locator('xpath=ancestor::a').first()
  return card.getAttribute('href')
}

test.describe('Fechamento mensal — aprovação e pagamento', () => {
  let periodoUrl: string | null = null

  test('solicita aprovação de fechamento em aberto', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    // Busca fechamento com status "Aberto" na listagem
    await page.goto(`${WAVE}/fechamento`)
    const abertoBadge = page.getByText(/\baberto\b/i).first()
    const hasAberto = await abertoBadge.isVisible({ timeout: 4_000 }).catch(() => false)

    if (!hasAberto) {
      test.skip(true, 'Nenhum fechamento com status "Aberto" encontrado na dev db')
      return
    }

    // Clica no card do fechamento aberto para ir ao detalhe
    const card = abertoBadge.locator('xpath=ancestor::a').first()
    const href = await card.getAttribute('href')
    if (!href) {
      test.skip(true, 'Não foi possível obter o link do fechamento')
      return
    }

    periodoUrl = href
    await page.goto(`${WAVE}${href}`)
    await page.waitForURL(/\/fechamento\/[^/]+$/, { timeout: 8_000 })

    await page.getByRole('button', { name: /solicitar aprovação/i }).click()

    await expect(
      page.getByText(/aguardando aprovação|solicitação enviada/i),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('aprova fechamento aguardando aprovação', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    // Usa o periodoUrl do teste anterior, ou busca um "aguardando_aprovacao" na listagem
    if (!periodoUrl) {
      await page.goto(`${WAVE}/fechamento`)
      const badge = page.getByText(/aguardando aprovação/i).first()
      const visible = await badge.isVisible({ timeout: 4_000 }).catch(() => false)
      if (!visible) {
        test.skip(true, 'Nenhum fechamento aguardando aprovação encontrado')
        return
      }
      const card = badge.locator('xpath=ancestor::a').first()
      periodoUrl = await card.getAttribute('href')
    }

    if (!periodoUrl) {
      test.skip(true, 'Período não determinado')
      return
    }

    await page.goto(`${WAVE}${periodoUrl}`)
    await page.waitForURL(/\/fechamento\/[^/]+$/, { timeout: 8_000 })

    await page.getByRole('button', { name: /aprovar fechamento/i }).click()

    await expect(
      page.getByText(/aprovado/i),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('marca fechamento aprovado como pago', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    if (!periodoUrl) {
      await page.goto(`${WAVE}/fechamento`)
      const badge = page.getByText(/\baprovado\b/i).first()
      const visible = await badge.isVisible({ timeout: 4_000 }).catch(() => false)
      if (!visible) {
        test.skip(true, 'Nenhum fechamento aprovado encontrado')
        return
      }
      const card = badge.locator('xpath=ancestor::a').first()
      periodoUrl = await card.getAttribute('href')
    }

    if (!periodoUrl) {
      test.skip(true, 'Período não determinado')
      return
    }

    await page.goto(`${WAVE}${periodoUrl}`)
    await page.waitForURL(/\/fechamento\/[^/]+$/, { timeout: 8_000 })

    await page.getByRole('button', { name: /marcar como pago/i }).click()

    await expect(
      page.getByText(/\bpago\b/i),
    ).toBeVisible({ timeout: 10_000 })
  })
})
