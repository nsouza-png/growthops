function chunkTextDeterministic(input, chunkSize = 500, overlap = 150) {
  const text = String(input || '').trim()
  if (!text) return []
  const safeOverlap = Math.max(0, Math.min(overlap, Math.max(chunkSize - 1, 0)))
  const step = Math.max(1, chunkSize - safeOverlap)
  const out = []
  for (let i = 0; i < text.length; i += step) {
    const part = text.slice(i, i + chunkSize).trim()
    if (part) out.push(part)
    if (i + chunkSize >= text.length) break
  }
  return out
}

function clampTopK(value, min = 1, max = 12, fallback = 8) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(Math.floor(n), max))
}

function sourceKeyForCall(callId) {
  return `call:${callId}:transcript`
}

module.exports = {
  chunkTextDeterministic,
  clampTopK,
  sourceKeyForCall,
}
