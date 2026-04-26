import { describe, expect, it } from 'vitest'
import { buildSnippetInsertPayload, buildTldvLink } from './utils'

describe('game-film utils', () => {
  it('builds tldv meeting link with timestamp', () => {
    const url = buildTldvLink({ tldv_call_id: 'abc123', tldv_url: null }, 42)
    expect(url).toBe('https://tldv.io/app/meetings/abc123?t=42')
  })

  it('falls back to tldv_url when meeting id is missing', () => {
    const url = buildTldvLink({ tldv_call_id: null, tldv_url: 'https://tldv.io/app/meetings/xyz' }, null)
    expect(url).toBe('https://tldv.io/app/meetings/xyz')
  })

  it('maps snippet payload with text and transcript_excerpt', () => {
    const payload = buildSnippetInsertPayload({
      callId: ' c1 ',
      title: '  Titulo  ',
      excerpt: ' Trecho ',
      tag: 'spiced',
      userId: 'u1',
    })
    expect(payload).toMatchObject({
      call_id: 'c1',
      title: 'Titulo',
      transcript_excerpt: 'Trecho',
      text: 'Trecho',
      tag: 'spiced',
      created_by: 'u1',
      is_public: false,
    })
  })
})

