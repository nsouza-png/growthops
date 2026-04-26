export type GameFilmCallRef = {
  tldv_call_id?: string | null
  tldv_url?: string | null
}

export function buildTldvLink(callRef: GameFilmCallRef, startSecond?: number | null): string | null {
  const meetingId = (callRef.tldv_call_id ?? '').trim()
  if (meetingId && !meetingId.startsWith('insight-')) {
    const base = `https://tldv.io/app/meetings/${meetingId}`
    return typeof startSecond === 'number' ? `${base}?t=${startSecond}` : base
  }
  const fallback = (callRef.tldv_url ?? '').trim()
  return fallback || null
}

export function buildSnippetInsertPayload(input: {
  callId?: string | null
  title: string
  excerpt: string
  tag?: string | null
  userId?: string | null
}) {
  const excerpt = input.excerpt.trim()
  return {
    call_id: input.callId?.trim() || null,
    title: input.title.trim(),
    transcript_excerpt: excerpt,
    text: excerpt,
    tag: input.tag || null,
    is_public: false,
    created_by: input.userId ?? null,
  }
}

