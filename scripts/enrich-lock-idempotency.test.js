const test = require('node:test')
const assert = require('node:assert/strict')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CALL_ID = (process.env.E2E_LOCK_TEST_CALL_ID || process.env.E2E_RAG_CALL_ID || '').trim()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

test('enrich-call lock is idempotent on duplicate trigger', async (t) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CALL_ID) {
    t.skip('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / E2E_LOCK_TEST_CALL_ID (or E2E_RAG_CALL_ID)')
    return
  }
  if (!UUID_RE.test(CALL_ID)) {
    t.skip('E2E_LOCK_TEST_CALL_ID (or E2E_RAG_CALL_ID) must be a valid UUID')
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'GrowthPlatform' },
  })

  const { error: resetErr } = await supabase
    .from('calls')
    .update({ processing_status: 'pending' })
    .eq('id', CALL_ID)
  assert.equal(resetErr, null, `Failed to reset call status: ${resetErr?.message}`)

  const first = await supabase.functions.invoke('enrich-call', { body: { call_id: CALL_ID } })
  assert.equal(first.error, null, `First enrich-call failed: ${first.error?.message}`)
  assert.equal(first.data?.ok, true)

  const second = await supabase.functions.invoke('enrich-call', { body: { call_id: CALL_ID } })
  assert.equal(second.error, null, `Second enrich-call failed: ${second.error?.message}`)
  assert.equal(second.data?.ok, true)
  assert.equal(second.data?.skipped, true, `Second call should skip, got: ${JSON.stringify(second.data)}`)
})

