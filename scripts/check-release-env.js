/* eslint-disable no-console */
/**
 * Validates required environment variables for npm run preflight:release.
 * Exit 1 with clear messages if anything is missing.
 */

const required = [
  'E2E_TEST_EMAIL',
  'E2E_TEST_PASSWORD',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'E2E_RAG_CALL_ID',
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const optionalHints = [
  { key: 'VITE_SUPABASE_URL', hint: 'frontend app must reach Supabase (usually in app/.env)' },
  { key: 'VITE_SUPABASE_ANON_KEY', hint: 'required for real login in Playwright' },
]

let fail = false
for (const key of required) {
  if (!process.env[key] || String(process.env[key]).trim() === '') {
    console.error(`[release-env] MISSING: ${key}`)
    fail = true
  }
}

for (const { key, hint } of optionalHints) {
  if (!process.env[key] || String(process.env[key]).trim() === '') {
    console.warn(`[release-env] OPTIONAL (recommended): ${key} — ${hint}`)
  }
}

if (fail) {
  console.error('\n[release-env] FAIL — set the variables above, then re-run preflight:release')
  process.exit(1)
}

const ragCallId = String(process.env.E2E_RAG_CALL_ID || '').trim()
if (!UUID_RE.test(ragCallId)) {
  console.error('[release-env] FAIL — E2E_RAG_CALL_ID must be a valid UUID')
  process.exit(1)
}

console.log('[release-env] PASS — required release variables are set')
