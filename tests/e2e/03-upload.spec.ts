import { test, expect } from '@playwright/test'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { loginAs } from '../fixtures/auth'
import { BASE_URLS } from '../fixtures/helpers'

const WAVE = BASE_URLS.manager
const SAMPLE_XLSX = resolve(__dirname, '../fixtures/sample.xlsx')

test.describe('Upload de planilha', () => {
  test.beforeAll(() => {
    if (!existsSync(SAMPLE_XLSX)) {
      throw new Error(`Fixture não encontrada: ${SAMPLE_XLSX}. Execute pnpm test:e2e para gerar via globalSetup.`)
    }
  })

  test('upload de planilha processa com sucesso', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    await page.goto(`${WAVE}/uploads/new`)

    // Faz o upload via file input (está invisível com opacity-0 mas ainda funcional)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(SAMPLE_XLSX)

    // Verifica que o nome do arquivo apareceu na UI
    await expect(page.getByText('sample.xlsx')).toBeVisible({ timeout: 5_000 })

    // Clica em "Enviar planilha"
    await page.getByRole('button', { name: /enviar planilha/i }).click()

    // Aguarda processamento completo (pode demorar até 30s)
    // A página redireciona para /uploads/[id] ao completar
    await page.waitForURL(/\/uploads\/[^/]+$/, { timeout: 30_000 })

    await page.waitForLoadState('networkidle')

    // Verifica que o badge de status é "Concluído" (success)
    await expect(page.getByText(/concluído/i)).toBeVisible({ timeout: 10_000 })

    // Verifica que visitas foram inseridas (campo "inseridas" > 0)
    await expect(page.getByText(/inseridas/i)).toBeVisible({ timeout: 5_000 })
  })

  test('re-upload do mesmo arquivo é detectado como duplicata', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${WAVE}/dashboard`, { timeout: 15_000 })

    await page.goto(`${WAVE}/uploads/new`)

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(SAMPLE_XLSX)
    await expect(page.getByText('sample.xlsx')).toBeVisible({ timeout: 5_000 })

    await page.getByRole('button', { name: /enviar planilha/i }).click()

    // Deve aparecer a mensagem de duplicata (sem redirecionar)
    await expect(
      page.getByText(/arquivo já foi enviado anteriormente/i),
    ).toBeVisible({ timeout: 15_000 })

    // Verifica que o link "Ver upload existente" existe
    await expect(
      page.getByRole('link', { name: /ver upload existente/i }),
    ).toBeVisible({ timeout: 3_000 })
  })
})
