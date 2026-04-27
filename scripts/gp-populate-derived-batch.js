#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { createClient } = require('@supabase/supabase-js')

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const batchSizeArg = args.find((a) => a.startsWith('--batch-size='))
const limitArg = args.find((a) => a.startsWith('--limit='))
const batchSize = batchSizeArg ? Number(batchSizeArg.split('=')[1]) : 20
const limit = limitArg ? Number(limitArg.split('=')[1]) : 300

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'GrowthPlatform' },
})

async function hasDerived(callId) {
  const checks = ['behavior_signals', 'business_analysis', 'closer_pdis']
  for (const table of checks) {
    const { data } = await supabase.from(table).select('id').eq('call_id', callId).maybeSingle()
    if (data) return true
  }
  return false
}

async function invokeSync(publicCallId) {
  const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/gp-pipeline-sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ public_call_id: publicCallId }),
  })
  return { ok: res.ok, status: res.status, body: await res.text() }
}

async function main() {
  const { data: caRows, error } = await supabase
    .from('call_analysis')
    .select('call_id,created_at')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Failed to load call_analysis rows: ${error.message}`)

  const candidates = []
  for (const row of caRows || []) {
    if (!row.call_id) continue
    const done = await hasDerived(row.call_id)
    if (!done) candidates.push(row.call_id)
  }

  console.log(`Candidates for gp-pipeline-sync: ${candidates.length} (from ${caRows?.length || 0} call_analysis rows)`)
  if (dryRun || candidates.length === 0) return

  let ok = 0
  let fail = 0
  const failures = []

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize)
    console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${batch.length}`)
    const results = await Promise.all(
      batch.map(async (id) => ({ id, ...(await invokeSync(id)) }))
    )
    for (const r of results) {
      if (r.ok) ok++
      else {
        fail++
        failures.push({ call_id: r.id, status: r.status, body: r.body.slice(0, 300) })
      }
    }
  }

  const summary = {
    timestamp: new Date().toISOString(),
    processed: candidates.length,
    success: ok,
    failed: fail,
    failures,
  }
  fs.writeFileSync('GP-POPULATE-DERIVED-SUMMARY.json', JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ processed: candidates.length, success: ok, failed: fail }, null, 2))
  console.log('Summary: GP-POPULATE-DERIVED-SUMMARY.json')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
