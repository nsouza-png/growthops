import { test, expect } from '@playwright/test'

test.describe('Performance route (auth gate)', () => {
  test('should redirect anonymous user to login from performance', async ({ page }) => {
    await page.goto('/#/performance')
    await expect(page).toHaveURL(/\/login(?:#\/login)?$/)
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('should never crash when performance route is opened', async ({ page }) => {
    await page.goto('/#/performance')
    await expect(page.locator('body')).toBeVisible()
  })
})
