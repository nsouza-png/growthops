export function nowMs() {
  return Date.now()
}

export function logStep(payload: {
  function_name: string
  call_id?: string
  step: string
  status: 'start' | 'ok' | 'error' | 'skip'
  duration_ms?: number
  details?: Record<string, unknown>
}) {
  const body = {
    ts: new Date().toISOString(),
    ...payload,
  }
  console.log(JSON.stringify(body))
}
