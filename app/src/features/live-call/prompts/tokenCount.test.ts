import { describe, it, expect } from 'vitest'
import { LIVE_CALL_SYSTEM_PROMPT } from './live-call-system-prompt'

describe('LIVE_CALL_SYSTEM_PROMPT token count', () => {
  it('estimated token count (word_count × 1.3) is in range 6000–10000', () => {
    const wordCount = LIVE_CALL_SYSTEM_PROMPT.split(/\s+/).filter(Boolean).length
    const estimatedTokens = Math.round(wordCount * 1.3)
    expect(estimatedTokens).toBeGreaterThanOrEqual(6_000)
    expect(estimatedTokens).toBeLessThanOrEqual(10_000)
  })

  // Live API test — skip if no API key
  const hasApiKey = Boolean(import.meta.env?.VITE_GEMINI_API_KEY)
  it.skipIf(!hasApiKey)('live countTokens via Gemini API is in range 6000–10000', async () => {
    const { requireGemini, GEMINI_MODEL } = await import('../../../lib/geminiClient')
    const result = await requireGemini().models.countTokens({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: LIVE_CALL_SYSTEM_PROMPT }] }],
    })
    console.log(`[tokenCount] actual tokens: ${result.totalTokens}`)
    expect(result.totalTokens).toBeGreaterThanOrEqual(6_000)
    expect(result.totalTokens).toBeLessThanOrEqual(10_000)
  })
})
