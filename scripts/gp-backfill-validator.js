#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { createClient } = require('@supabase/supabase-js')

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const args = process.argv.slice(2)
const showIncomplete = args.includes('--show-incomplete')
const limitArg = args.find((a) => a.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : 50

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'GrowthPlatform' },
})

async function count(table) {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true })
  if (error) throw new Error(`${table}: ${error.message}`)
  return count || 0
}

async function main() {
  const callsTotal = await count('calls')
  const analysisTotal = await count('call_analysis')
  const frameworkTotal = await count('framework_scores')
  const behaviorTotal = await count('behavior_signals')
  const businessTotal = await count('business_analysis')
  const followupsTotal = await count('call_followups')
  const pdiTotal = await count('closer_pdis')

  console.log('=== GP Backfill Validation ===')
  console.log(`calls: ${callsTotal}`)
  console.log(`call_analysis: ${analysisTotal}`)
  console.log(`framework_scores: ${frameworkTotal}`)
  console.log(`behavior_signals: ${behaviorTotal}`)
  console.log(`business_analysis: ${businessTotal}`)
  console.log(`call_followups: ${followupsTotal}`)
  console.log(`closer_pdis: ${pdiTotal}`)

  const missing = Math.max(0, callsTotal - analysisTotal)
  console.log(`\nMissing call_analysis: ${missing}`)

  if (showIncomplete) {
    const { data, error } = await supabase
      .from('calls')
      .select('id,created_at')
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) throw new Error(error.message)

    const incomplete = []
    for (const row of data || []) {
      const { data: ca } = await supabase.from('call_analysis').select('call_id').eq('call_id', row.id).maybeSingle()
      if (!ca) incomplete.push(row.id)
    }
    console.log(`\nSample incomplete call_ids (${incomplete.length}):`)
    incomplete.forEach((id) => console.log(`- ${id}`))
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
