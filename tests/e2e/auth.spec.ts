import { test, expect } from '@playwright/test'
import { loginAs, BASE_URLS } from '../fixtures/auth'

test.describe('Técnico — visualização de dados próprios', () => {
  test('técnico logado acessa portal e vê sua home', async ({ page }) => {
    await loginAs(page, 'technician')
    await page.waitForURL(`${BASE_URLS.technician}/profile`, { timeout: 15_000 })

    // Verifica que carregou o portal do técnico (heading ou card visível)
    await expect(
      page.getByRole('heading').first().or(page.getByText(/meu perfil/i).first()),
    ).toBeVisible({ timeout: 8_000 })

    // Verifica que não há sidebar de manager (itens exclusivos do manager não aparecem)
    await expect(page.getByRole('link', { name: /fechamento/i })).not.toBeVisible()
    await expect(page.getByRole('link', { name: /uploads/i })).not.toBeVisible()
  })
})

test.describe('Login flows', () => {
  test('admin login redirects to /admin/dashboard', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.waitForURL(`${BASE_URLS.admin}/admin/dashboard`, { timeout: 10_000 })
    await expect(page).toHaveURL(`${BASE_URLS.admin}/admin/dashboard`)
  })

  test('manager login redirects to /dashboard', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.waitForURL(`${BASE_URLS.manager}/dashboard`, { timeout: 10_000 })
    await expect(page).toHaveURL(`${BASE_URLS.manager}/dashboard`)
  })

  test('technician login redirects to /profile', async ({ page }) => {
    await loginAs(page, 'technician')
    await page.waitForURL(`${BASE_URLS.technician}/profile`, { timeout: 10_000 })
    await expect(page).toHaveURL(`${BASE_URLS.technician}/profile`)
  })

  test('invalid credentials shows error message', async ({ page }) => {
    await page.goto(`${BASE_URLS.manager}/login`)
    await page.locator('#email').fill('invalido@teste.com')
    await page.locator('#password').fill('senhaerrada123')
    await page.getByRole('button', { name: /entrar na plataforma/i }).click()
    await expect(page.getByText(/e-mail ou senha inválidos/i)).toBeVisible({ timeout: 5_000 })
  })
})
