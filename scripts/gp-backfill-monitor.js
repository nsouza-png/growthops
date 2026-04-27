#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')

const checkpointFile = path.join(process.cwd(), 'backfill-checkpoint.json')

function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}h ${m}m ${sec}s`
}

function main() {
  if (!fs.existsSync(checkpointFile)) {
    console.error('Checkpoint not found: backfill-checkpoint.json')
    process.exit(1)
  }
  const cp = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'))
  const processed = cp.processed_count || 0
  const total = cp.total_calls || 0
  const pct = total > 0 ? ((processed / total) * 100).toFixed(2) : '0.00'
  const start = new Date(cp.start_time).getTime()
  const now = Date.now()
  const elapsed = now - start
  const rate = elapsed > 0 ? (processed / (elapsed / 60000)) : 0
  const remaining = rate > 0 ? ((total - processed) / rate) * 60000 : 0

  console.log('=== GP Backfill Monitor ===')
  console.log(`Status: ${cp.status}`)
  console.log(`Processed: ${processed}/${total} (${pct}%)`)
  console.log(`Success: ${cp.success_count || 0}`)
  console.log(`Failed: ${cp.failed_count || 0}`)
  console.log(`Batches: ${cp.batch_number || 0}`)
  console.log(`Elapsed: ${fmtDuration(elapsed)}`)
  console.log(`Rate: ${rate.toFixed(2)} calls/min`)
  console.log(`ETA: ${rate > 0 ? fmtDuration(remaining) : 'n/a'}`)
  console.log(`Last update: ${cp.last_update}`)

  if ((cp.failed_calls || []).length > 0) {
    console.log('\nRecent failures:')
    ;(cp.failed_calls || []).slice(0, 10).forEach((f) => {
      console.log(`- ${f.call_id} | retries=${f.retry_count} | ${f.error}`)
    })
  }
}

main()
