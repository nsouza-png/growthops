import test from 'node:test'
import assert from 'node:assert/strict'
import { canStartEnrich } from '../supabase/functions/_shared/pipeline-locks.mjs'

test('canStartEnrich allows only pending or enrich_failed', () => {
  const allowed = ['pending', 'enrich_failed', 'PENDING', ' enrich_failed ']
  for (const status of allowed) {
    assert.equal(canStartEnrich(status), true, `expected allow for status=${status}`)
  }

  const blocked = [
    undefined,
    null,
    '',
    'enriching',
    'enriched',
    'partially_enriched',
    'fetching_transcript',
    'analyzed',
    'whatever',
  ]
  for (const status of blocked) {
    assert.equal(canStartEnrich(status), false, `expected block for status=${String(status)}`)
  }
})

