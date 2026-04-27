/* eslint-disable no-console */
/**
 * Fill missing call_analysis rows by invoking analyze-call in controlled batches.
 *
 * Safety rules:
 * - Never touches calls listed in --protect.
 * - Only processes calls without call_analysis row.
 * - Updates status to pending only when needed for pipeline lock.
 *
 * Usage:
 *   node scripts/fill-missing-analyses-batch.js --batch-size 50 --limit 200
 *   node scripts/fill-missing-analyses-batch.js --protect <call1,call2>
 *   node scripts/fill-missing-analyses-batch.js --dry-run
 */
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const batchIdx = argv.indexOf('--batch-size')
const limitIdx = argv.indexOf('--limit')
const protectIdx = argv.indexOf('--protect')

const BATCH_SIZE = batchIdx !== -1 ? Number(argv[batchIdx + 1]) : 50
const LIMIT = limitIdx !== -1 ? Number(argv[limitIdx + 1]) : 200
const PROTECT = new Set(
  protectIdx !== -1 && argv[protectIdx + 1]
    ? argv[protectIdx + 1].split(',').map((s) => s.trim()).filter(Boolean)
    : []
)

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx), line.slice(idx + 1)]
    })
)

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'GrowthPlatform' },
})

async function invokeAnalyze(callId) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 35000)
  try {
    const res = await fetch(`${env.SUPABASE_URL}/functions/v1/analyze-call`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ call_id: callId }),
      signal: controller.signal,
    })
    const body = await res.text()
    return { ok: res.ok, status: res.status, body }
  } catch (err) {
    return { ok: false, status: 0, body: String(err) }
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  console.log(`fill-missing-analyses-batch | dry-run=${DRY_RUN} | batch=${BATCH_SIZE} | limit=${LIMIT}`)
  if (PROTECT.size > 0) {
    console.log(`Protected call_ids: ${Array.from(PROTECT).join(', ')}`)
  }

  const { data: missingRows, error: missingError } = await supabase
    .from('calls')
    .select('id,processing_status')
    .not('id', 'in', `(${Array.from(PROTECT).map((id) => `"${id}"`).join(',') || '""'})`)
    .not('processing_status', 'eq', 'analyzed')
    .order('created_at', { ascending: true })
    .limit(LIMIT)

  if (missingError) {
    console.error('Failed to load candidate calls:', missingError.message)
    process.exit(1)
  }

  // Keep only rows with no call_analysis entry.
  const candidates = []
  for (const row of missingRows || []) {
    const { data: ca } = await supabase.from('call_analysis').select('call_id').eq('call_id', row.id).maybeSingle()
    if (!ca) candidates.push(row)
  }

  console.log(`Candidates without analysis: ${candidates.length}`)
  if (DRY_RUN || candidates.length === 0) return

  let success = 0
  let failed = 0
  const failures = []

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} calls`)
    for (const row of batch) {
      // analyze-call path expects pending for lock-safe pipeline progression.
      if (!['pending', 'enrich_failed'].includes((row.processing_status || '').toLowerCase())) {
        await supabase.from('calls').update({ processing_status: 'pending' }).eq('id', row.id)
      }

      const res = await invokeAnalyze(row.id)
      if (res.ok) {
        success++
      } else {
        failed++
        failures.push({ call_id: row.id, status: res.status, body: res.body.slice(0, 400) })
      }
    }
  }

  const summary = {
    timestamp: new Date().toISOString(),
    limit: LIMIT,
    batch_size: BATCH_SIZE,
    protected_call_ids: Array.from(PROTECT),
    processed: candidates.length,
    success,
    failed,
    failures,
  }

  fs.writeFileSync('FILL-MISSING-ANALYSES-SUMMARY.json', JSON.stringify(summary, null, 2), 'utf8')
  console.log('\nDone.')
  console.log(JSON.stringify({ processed: candidates.length, success, failed }, null, 2))
  console.log('Summary file: FILL-MISSING-ANALYSES-SUMMARY.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
