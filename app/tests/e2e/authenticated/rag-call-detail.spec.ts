import { test, expect } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = (process.env[name] ?? '').trim()
  if (!value) throw new Error(`${name} is required for authenticated E2E`)
  return value
}

test.describe('Authenticated RAG on Call Detail', () => {
  test('should show RAG summary block for configured call', async ({ page }) => {
    const email = requiredEnv('E2E_TEST_EMAIL')
    const password = requiredEnv('E2E_TEST_PASSWORD')
    const callId = requiredEnv('E2E_RAG_CALL_ID')
    await page.goto('/#/login')
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await expect(page).not.toHaveURL(/#\/login$/)

    await page.goto(`/#/calls/${callId}`)
    await expect(page).not.toHaveURL(/#\/login$/)

    await expect(page.getByText('Resumo RAG (transcrição)')).toBeVisible({ timeout: 120000 })
  })
})
