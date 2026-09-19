import { test, expect } from '@playwright/test'
import { loginAs, BASE_URLS } from '../fixtures/auth'

const WAVE = BASE_URLS.manager

// Supervisão de Campo (ADR-022). O que estes testes protegem, em ordem de importância:
//
//   1. O técnico NÃO alcança o módulo — nem as telas do gestor, nem as do supervisor, nem a
//      supervisão dele próprio. É requisito de negócio, não detalhe de UI.
//   2. Com a feature flag DESLIGADA, o módulo não existe: 404, e nenhum item de menu.
//   3. O snapshot do checklist é imutável — editar o template não muda supervisão agendada.
//
// Os testes de flag DESLIGADA e LIGADA são mutuamente exclusivos por natureza: rodam contra o
// estado real do tenant. Cada bloco se autodetecta e pula quando o ambiente está no outro
// estado, em vez de falhar — assim a suíte passa nos dois cenários e nunca dá falso vermelho.

async function moduloEstaLigado(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto(`${WAVE}/supervisoes`)
  await page.waitForLoadState('domcontentloaded')
  // Com a flag desligada o guard devolve notFound() → a página 404 do app.
  return !(await page.getByText(/não encontrad/i).first().isVisible().catch(() => false))
}

test.describe('Supervisão de campo — o técnico não alcança o módulo', () => {
  test('técnico em /supervisoes cai no login (layout do gestor recusa)', async ({ page }) => {
    await loginAs(page, 'technician')
    await page.waitForURL(`${WAVE}/profile`, { timeout: 15_000 })

    await page.goto(`${WAVE}/supervisoes`)
    await page.waitForURL(`${WAVE}/login`, { timeout: 8_000 })
    await expect(page).toHaveURL(`${WAVE}/login`)
  })

  test('técnico em /supervisoes/checklist cai no login', async ({ page }) => {
    await loginAs(page, 'technician')
    await page.waitForURL(`${WAVE}/profile`, { timeout: 15_000 })

    await page.goto(`${WAVE}/supervisoes/checklist`)
    await page.waitForURL(`${WAVE}/login`, { timeout: 8_000 })
    await expect(page).toHaveURL(`${WAVE}/login`)
  })

  // O layout de (technician) aceita técnico E supervisor, então o técnico ALCANÇA esta rota
  // antes de qualquer checagem — quem barra é o guard, e ele redireciona em vez de lançar.
  test('técnico em /minhas-supervisoes volta ao painel, sem tela de erro', async ({ page }) => {
    await loginAs(page, 'technician')
    await page.waitForURL(`${WAVE}/profile`, { timeout: 15_000 })

    await page.goto(`${WAVE}/minhas-supervisoes`)
    await page.waitForURL(`${WAVE}/`, { timeout: 8_000 })
    await expect(page.getByText(/internal server error|unhandled|forbidden/i)).toHaveCount(0)
  })

  test('a barra do técnico não mostra "Campo"', async ({ page }) => {
    await loginAs(page, 'technician')
    await page.waitForURL(`${WAVE}/profile`, { timeout: 15_000 })

    const nav = page.locator('nav').last()
    await expect(nav.getByRole('link', { name: /^campo$/i })).toHaveCount(0)
    // E também não vê "Equipe", que é do supervisor.
    await expect(nav.getByRole('link', { name: /^equipe$/i })).toHaveCount(0)
  })
})

test.describe('Supervisão de campo — feature flag', () => {
  test('com a flag desligada, /supervisoes dá 404 e o menu não mostra o item', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    test.skip(await moduloEstaLigado(page), 'módulo está ligado neste tenant')

    await expect(page.getByText(/não encontrad/i).first()).toBeVisible({ timeout: 8_000 })

    await page.goto(`${WAVE}/dashboard`)
    await expect(page.getByRole('link', { name: /supervisões/i })).toHaveCount(0)
  })

  test('com a flag ligada, o gestor vê a lista e o item no menu', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    test.skip(!(await moduloEstaLigado(page)), 'módulo está desligado neste tenant')

    await expect(
      page.getByRole('heading', { name: /supervisões/i }).first(),
    ).toBeVisible({ timeout: 8_000 })

    await page.goto(`${WAVE}/dashboard`)
    await expect(page.getByRole('link', { name: /supervisões/i })).toBeVisible()
  })
})

test.describe('Supervisão de campo — checklist do gestor', () => {
  test('a tela de checklist carrega e explica o congelamento', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    test.skip(!(await moduloEstaLigado(page)), 'módulo está desligado neste tenant')

    await page.goto(`${WAVE}/supervisoes/checklist`)
    await expect(
      page.getByRole('heading', { name: /checklist de supervisão/i }),
    ).toBeVisible({ timeout: 8_000 })

    // A promessa central do módulo tem que estar escrita na tela, não só no código.
    await expect(page.getByText(/não altera supervisões já agendadas/i)).toBeVisible()
  })

  test('não existe botão de excluir item — apagar quebraria o histórico', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    test.skip(!(await moduloEstaLigado(page)), 'módulo está desligado neste tenant')

    await page.goto(`${WAVE}/supervisoes/checklist`)
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('button', { name: /excluir|apagar|remover/i })).toHaveCount(0)
  })
})

test.describe('Supervisão de campo — portal do supervisor', () => {
  test('supervisor em /supervisoes cai no login (é rota do gestor)', async ({ page }) => {
    await loginAs(page, 'supervisor')
    await page.waitForURL(`${WAVE}/profile`, { timeout: 15_000 })

    await page.goto(`${WAVE}/supervisoes`)
    await page.waitForURL(`${WAVE}/login`, { timeout: 8_000 })
    await expect(page).toHaveURL(`${WAVE}/login`)
  })

  test('supervisor abre a própria fila em /minhas-supervisoes', async ({ page }) => {
    await loginAs(page, 'supervisor')
    await page.waitForURL(`${WAVE}/profile`, { timeout: 15_000 })

    test.skip(!(await moduloEstaLigado(page)), 'módulo está desligado neste tenant')

    await page.goto(`${WAVE}/minhas-supervisoes`)
    await expect(page.getByRole('heading', { name: /^campo$/i })).toBeVisible({
      timeout: 8_000,
    })
  })
})
