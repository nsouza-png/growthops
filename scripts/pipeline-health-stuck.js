/* eslint-disable no-console */
/**
 * Lists calls that look stuck in pipeline locks or transcript fetch.
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required)
 *   STUCK_MINUTES (default 15)
 */
require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const minutes = Math.max(1, Number(process.env.STUCK_MINUTES || 15))
const thresholdIso = new Date(Date.now() - minutes * 60 * 1000).toISOString()

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
  db: { schema: 'GrowthPlatform' },
})

async function run() {
  console.log(`[pipeline-health] stuck threshold: updated_at / *_started_at before ${thresholdIso} (${minutes}m)`)

  const { data: byProcessing, error: e1 } = await supabase
    .from('calls')
    .select('id, processing_status, updated_at, transcript_fetched, rag_index_status, rag_enrich_status')
    .eq('processing_status', 'fetching_transcript')
    .lt('updated_at', thresholdIso)

  if (e1) throw e1

  const { data: byRagIndex, error: e2 } = await supabase
    .from('calls')
    .select('id, processing_status, rag_index_status, rag_index_started_at')
    .eq('rag_index_status', 'indexing')
    .lt('rag_index_started_at', thresholdIso)

  if (e2) throw e2

  const { data: byRagEnrich, error: e3 } = await supabase
    .from('calls')
    .select('id, processing_status, rag_enrich_status, rag_enrich_started_at')
    .eq('rag_enrich_status', 'enriching')
    .lt('rag_enrich_started_at', thresholdIso)

  if (e3) throw e3

  const stuckFetch = byProcessing ?? []
  const stuckIndex = byRagIndex ?? []
  const stuckEnrich = byRagEnrich ?? []

  console.log(JSON.stringify({ stuck_fetching_transcript: stuckFetch, stuck_rag_indexing: stuckIndex, stuck_rag_enriching: stuckEnrich }, null, 2))

  const total = stuckFetch.length + stuckIndex.length + stuckEnrich.length
  if (total > 0) {
    console.log(`[pipeline-health] WARN — ${total} row(s) look stuck (review GO-LIVE-RUNBOOK.md)`)
    process.exitCode = 2
  } else {
    console.log('[pipeline-health] OK — no stuck rows for configured windows')
  }
}

function missingGrowthPlatformSchema(err) {
  const code = err?.code
  const msg = String(err?.message || err || '')
  return code === '42P01' || /GrowthPlatform\.\w+.*does not exist/i.test(msg) || /relation.*does not exist/i.test(msg)
}

run().catch((err) => {
  if (missingGrowthPlatformSchema(err)) {
    console.error(
      '[pipeline-health] FAIL: GrowthPlatform tables are missing on this database (often migrations not applied or wrong project).',
      '\nFix: reconcile `supabase/migrations` with the linked project (`supabase db pull` / `db push` after repair), then re-run.',
    )
    process.exit(1)
  }
  console.error('[pipeline-health] FAIL:', err)
  process.exit(1)
})
