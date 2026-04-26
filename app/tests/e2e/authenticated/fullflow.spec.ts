import { test, expect } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = (process.env[name] ?? '').trim()
  if (!value) throw new Error(`${name} is required for authenticated E2E`)
  return value
}

test.describe('Authenticated Full Flow', () => {
  test('should login and navigate core screens', async ({ page }) => {
    const email = requiredEnv('E2E_TEST_EMAIL')
    const password = requiredEnv('E2E_TEST_PASSWORD')
    await page.goto('/#/login')
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')

    await expect(page).not.toHaveURL(/#\/login$/)
    await expect(page.locator('body')).toBeVisible()

    await page.goto('/#/performance')
    await expect(page).not.toHaveURL(/#\/login$/)
    await expect(page.locator('body')).toBeVisible()

    await page.goto('/#/insights')
    await expect(page).not.toHaveURL(/#\/login$/)
    await expect(page.locator('body')).toBeVisible()

    await page.goto('/#/pdi')
    await expect(page).not.toHaveURL(/#\/login$/)
    await expect(page.locator('body')).toBeVisible()

    await page.goto('/#/calls')
    await expect(page).not.toHaveURL(/#\/login$/)
    await expect(page.locator('body')).toBeVisible()
  })
})
