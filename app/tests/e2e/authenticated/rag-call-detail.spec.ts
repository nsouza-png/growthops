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
    const callId = (process.env.E2E_RAG_CALL_ID ?? '').trim()
    const PLACEHOLDER = 'a0a0a0a0-b1b1-42c2-93d3-e4e4e4e4e4e4'
    if (!callId || callId === PLACEHOLDER) {
      test.skip(true, 'E2E_RAG_CALL_ID not set to a real call — skipping RAG detail check')
      return
    }
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
