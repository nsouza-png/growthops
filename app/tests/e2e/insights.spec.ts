import { test, expect } from '@playwright/test'

test.describe('Insights Hub Functionality', () => {
  test('should redirect anonymous user to login from insights', async ({ page }) => {
    await page.goto('/insights')
    await expect(page).toHaveURL(/\/login(?:#\/login)?$/)
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('should keep app responsive when visiting insights route', async ({ page }) => {
    await page.goto('/insights')
    await expect(page.locator('body')).toBeVisible()
  })
})
