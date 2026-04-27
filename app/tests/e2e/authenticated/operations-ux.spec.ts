import { test, expect } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = (process.env[name] ?? '').trim()
  if (!value) throw new Error(`${name} is required for authenticated E2E`)
  return value
}

test.describe('Operations UX', () => {
  test('opens operations panel and shows operational sections', async ({ page }) => {
    const email = requiredEnv('E2E_TEST_EMAIL')
    const password = requiredEnv('E2E_TEST_PASSWORD')
    await page.goto('/#/login')
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await expect(page).not.toHaveURL(/#\/login$/)

    await page.goto('/#/operations')
    await expect(page.getByText('Pipeline Health')).toBeVisible()
    await expect(page.getByText('Transparência Databricks')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Atualizar' })).toBeVisible()
  })
})

