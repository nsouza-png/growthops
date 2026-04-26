import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should render login screen', async ({ page }) => {
    await page.goto('/#/login')

    await expect(page.locator('h1')).toContainText('Growth Ops')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page).toHaveURL(/\/login(?:#\/login)?$/)
  })

  test('should protect authenticated routes', async ({ page }) => {
    await page.goto('/#/performance')
    await expect(page).toHaveURL(/\/login(?:#\/login)?$/)

    await page.goto('/#/calls')
    await expect(page).toHaveURL(/\/login(?:#\/login)?$/)
  })
})
