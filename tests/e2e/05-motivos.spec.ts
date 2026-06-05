import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth'
import { BASE_URLS } from '../fixtures/helpers'

const WAVE = BASE_URLS.manager

test.describe('Configuração de motivo', () => {
  test('classifica motivo pendente com categoria', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    await page.goto(`${WAVE}/motivos?categoria=pendente_classificacao`)

    // Verifica se há motivos pendentes
    const editLink = page.getByRole('link', { name: /editar/i }).first()
    const hasPending = await editLink.isVisible({ timeout: 4_000 }).catch(() => false)

    if (!hasPending) {
      test.skip(true, 'Nenhum motivo com status pendente_classificacao encontrado na dev db')
      return
    }

    await editLink.click()
    await page.waitForURL(/\/motivos\/.+\/edit/, { timeout: 8_000 })

    // Seleciona a categoria "Falha do Cliente"
    await page.locator('input[type="radio"][value="falha_cliente"]').check()
    await expect(
      page.locator('input[type="radio"][value="falha_cliente"]'),
    ).toBeChecked()

    await page.getByRole('button', { name: /salvar motivo/i }).click()

    // Verifica mensagem de sucesso
    await expect(
      page.getByText(/motivo salvo com sucesso/i),
    ).toBeVisible({ timeout: 8_000 })
  })
})
