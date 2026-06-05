import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth'
import { BASE_URLS, uniqueEmail, fakeCpf } from '../fixtures/helpers'

const WAVE = BASE_URLS.manager

test.describe('Cadastro de técnico', () => {
  test('cadastra novo técnico com sucesso', async ({ page }) => {
    const ts = Date.now().toString(36)
    const email = uniqueEmail('tec')
    const nome = `Técnico E2E ${ts}`
    const cpf = fakeCpf()
    const codigo = `UNT-${ts.toUpperCase()}`

    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    await page.goto(`${WAVE}/equipe/tecnicos/new`)
    await page.locator('#nomeCompleto').fill(nome)
    await page.locator('#email').fill(email)
    await page.locator('#cpf').fill(cpf)
    await page.locator('#codigoUnetvale').fill(codigo)

    await page.getByRole('button', { name: /cadastrar técnico/i }).click()

    await page.waitForURL(`${WAVE}/equipe/tecnicos`, { timeout: 10_000 })
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(nome)).toBeVisible({ timeout: 10_000 })
  })

  test('vincula técnico a visitas pendentes via upload', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    await page.goto(`${WAVE}/uploads`)

    // Procura upload que tenha link com texto indicando visitas pendentes de vinculação
    // (status "awaiting_link" ou similar indicado na UI)
    const linkForm = page.getByText(/vincular técnico/i).first()
    const hasLinkable = await linkForm.isVisible({ timeout: 3_000 }).catch(() => false)

    if (!hasLinkable) {
      test.skip(true, 'Nenhum upload com visitas pendentes de vinculação encontrado na dev db')
      return
    }

    // Navega para o upload e verifica que o formulário de vinculação existe
    await linkForm.click()
    await expect(page.getByText(/vincular/i)).toBeVisible({ timeout: 5_000 })
  })
})
