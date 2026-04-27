/* eslint-disable no-console */
/**
 * Runtime RAG pipeline validation against a real Supabase project.
 *
 * Flow (when transcript exists on call):
 *   rag-index-transcript → rag-enrich-call (explicit) → poll call_analysis for rag_* columns
 *
 * Optional first step (server must have TLDV_API_KEY):
 *   RUN_FETCH_TRANSCRIPT=1  → invokes fetch-transcript (skipped by edge if already fetched)
 *require('dotenv').config() * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required)
 *   E2E_RAG_CALL_ID or argv[2] (required)
 *   RAG_POLL_MS (default 3000), RAG_POLL_MAX (default 40)
 */

const { createClient } = require('@supabase/supabase-js')

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const callId = (process.argv[2] || process.env.E2E_RAG_CALL_ID || '').trim()
const runFetch = process.env.RUN_FETCH_TRANSCRIPT === '1'
const pollMs = Number(process.env.RAG_POLL_MS || 3000)
const pollMax = Number(process.env.RAG_POLL_MAX || 40)

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!callId) {
  console.error('Missing E2E_RAG_CALL_ID or pass call_id as first argument')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
  db: { schema: 'GrowthPlatform' },
})

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    throw new Error(`${name}: ${error.message || JSON.stringify(error)}`)
  }
  return data
}

function validateRagRow(row) {
  const errors = []
  if (!row) {
    errors.push('call_analysis row missing')
    return errors
  }
  const summary = row.rag_enriched_summary
  if (typeof summary !== 'string' || summary.trim().length === 0) {
    errors.push('rag_enriched_summary empty or not a string')
  }
  const sources = row.rag_sources
  if (!Array.isArray(sources)) {
    errors.push('rag_sources must be an array')
  } else {
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i]
      if (!s || typeof s !== 'object') {
        errors.push(`rag_sources[${i}] invalid`)
        break
      }
      if (typeof s.source !== 'string') errors.push(`rag_sources[${i}].source must be string`)
      if (typeof s.chunk_index !== 'number') errors.push(`rag_sources[${i}].chunk_index must be number`)
      if (typeof s.similarity !== 'number') errors.push(`rag_sources[${i}].similarity must be number`)
    }
  }
  if (!row.rag_last_updated_at) {
    errors.push('rag_last_updated_at missing')
  }
  return errors
}

async function main() {
  console.log(`[rag-runtime] call_id=${callId}`)

  const { data: call, error: callErr } = await supabase
    .from('calls')
    .select('id, transcript_text, transcript_fetched, processing_status')
    .eq('id', callId)
    .single()

  if (callErr || !call) {
    console.error('[rag-runtime] call not found:', callErr?.message)
    process.exit(1)
  }

  if (runFetch) {
    console.log('[rag-runtime] invoking fetch-transcript …')
    const fr = await invoke('fetch-transcript', { call_id: callId })
    console.log('[rag-runtime] fetch-transcript result:', fr)
  }

  const { data: callAfter } = await supabase
    .from('calls')
    .select('transcript_text')
    .eq('id', callId)
    .single()

  const text = (callAfter?.transcript_text || '').trim()
  if (!text) {
    console.error(
      '[rag-runtime] calls.transcript_text is empty. Run pipeline until fetch-transcript succeeds, or set RUN_FETCH_TRANSCRIPT=1 with TLDV_API_KEY on the project.',
    )
    process.exit(1)
  }

  console.log('[rag-runtime] invoking rag-index-transcript …')
  const idx = await invoke('rag-index-transcript', {
    call_id: callId,
    chunkSize: 500,
    chunkOverlap: 150,
    auto_enrich: false,
  })
  console.log('[rag-runtime] rag-index-transcript:', idx)

  await sleep(2000)

  const topK = Number(process.env.RAG_MATCH_TOP_K_DEFAULT || process.env.RAG_TOP_K || 8)
  console.log('[rag-runtime] invoking rag-enrich-call … topK=', topK)
  const enr = await invoke('rag-enrich-call', { call_id: callId, topK })
  console.log('[rag-runtime] rag-enrich-call:', enr?.ok ? 'ok' : enr)

  for (let i = 0; i < pollMax; i++) {
    const { data: analysis, error: aErr } = await supabase
      .from('call_analysis')
      .select('rag_enriched_summary, rag_sources, rag_last_updated_at')
      .eq('call_id', callId)
      .maybeSingle()

    if (aErr) {
      console.error('[rag-runtime] read call_analysis:', aErr.message)
      process.exit(1)
    }

    const errs = validateRagRow(analysis)
    if (errs.length === 0) {
      console.log('[rag-runtime] PASS — DB rag columns valid')
      process.exit(0)
    }
    console.log(`[rag-runtime] poll ${i + 1}/${pollMax}: ${errs.join('; ')}`)
    await sleep(pollMs)
  }

  console.error('[rag-runtime] FAIL — timeout waiting for valid rag_* columns')
  process.exit(1)
}

main().catch((err) => {
  console.error('[rag-runtime] FAIL:', err)
  process.exit(1)
})
