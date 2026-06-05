import type { Page } from '@playwright/test'

export const BASE_URLS = {
  admin: 'http://admin.localhost:3000',
  manager: 'http://wave.localhost:3000',
  technician: 'http://wave.localhost:3000',
}

/** Aguarda texto visível na página */
export async function waitForText(page: Page, text: string | RegExp, timeout = 10_000) {
  await page.getByText(text).first().waitFor({ state: 'visible', timeout })
}

/** Verifica banner de sucesso ou mensagem de confirmação */
export async function expectSuccess(page: Page, text: string | RegExp, timeout = 8_000) {
  await page.getByText(text).first().waitFor({ state: 'visible', timeout })
}

/** Gera slug único para testes (evita colisão com dev db) */
export function uniqueSlug(prefix = 'e2e') {
  return `${prefix}-${Date.now().toString(36)}`
}

/** Gera email único para testes */
export function uniqueEmail(prefix = 'e2e') {
  return `${prefix}-${Date.now().toString(36)}@test.dev`
}

/** CPF faker simples para testes (não validado pelo sistema) */
export function fakeCpf() {
  const n = Date.now().toString().slice(-9).padStart(9, '0')
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-00`
}

/** Interage com shadcn Select via click no trigger e item */
export async function selectOption(page: Page, triggerSelector: string, optionText: string) {
  await page.locator(triggerSelector).click()
  await page.getByRole('option', { name: optionText }).click()
}
