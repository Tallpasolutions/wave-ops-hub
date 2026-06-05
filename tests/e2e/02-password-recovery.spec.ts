import { test, expect } from '@playwright/test'
import { BASE_URLS } from '../fixtures/helpers'

const WAVE = BASE_URLS.manager

test.describe('Recuperação de senha', () => {
  test('link "Esqueci minha senha" redireciona para /forgot-password', async ({ page }) => {
    await page.goto(`${WAVE}/login`)
    await page.getByRole('link', { name: /esqueci minha senha/i }).click()
    await page.waitForURL(`${WAVE}/forgot-password`, { timeout: 8_000 })
    await expect(page).toHaveURL(`${WAVE}/forgot-password`)
  })

  test('submeter e-mail exibe confirmação de envio', async ({ page }) => {
    const email = process.env.PLAYWRIGHT_MANAGER_EMAIL
    if (!email) {
      test.skip(true, 'PLAYWRIGHT_MANAGER_EMAIL não configurado')
      return
    }

    await page.goto(`${WAVE}/forgot-password`)
    await page.locator('#email').fill(email)
    await page.getByRole('button', { name: /enviar link de recuperação/i }).click()

    await expect(
      page.getByText(/enviamos um link de recuperação/i),
    ).toBeVisible({ timeout: 10_000 })
  })
})
