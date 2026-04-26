export function normalizeStatus(status) {
  if (typeof status !== 'string') return ''
  return status.trim().toLowerCase()
}

export function canStartEnrich(status) {
  const normalized = normalizeStatus(status)
  return normalized === 'pending' || normalized === 'enrich_failed'
}

