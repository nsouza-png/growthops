/* eslint-disable no-console */
/**
 * merge-precomputed-analysis.js
 *
 * Integra análises pré-computadas (JSON locais) ao fluxo de calls do GrowthOps.
 * Regra de merge: preenche apenas campos null/vazios — não sobrescreve dados válidos.
 * Registra etapa em pipeline_events para rastreabilidade.
 *
 * Uso:
 *   node scripts/merge-precomputed-analysis.js <call_id>
 *   node scripts/merge-precomputed-analysis.js --all --dir <pasta>
 *   node scripts/merge-precomputed-analysis.js --dry-run --all --dir <pasta>
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'GrowthPlatform' },
})

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const ALL_MODE = argv.includes('--all')
const dirIdx = argv.indexOf('--dir')
const SOURCE_DIR = dirIdx !== -1 ? argv[dirIdx + 1] : process.env.RAG_SOURCE_DIR
const SINGLE_CALL_ID = argv.find((a) => !a.startsWith('-') && a.length > 10)

// ── Helpers ──────────────────────────────────────────────────────────────────

function isNullOrEmpty(val) {
  if (val === null || val === undefined) return true
  if (typeof val === 'string' && val.trim() === '') return true
  if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) return true
  if (Array.isArray(val) && val.length === 0) return true
  return false
}

/** Merge dois objetos: mantém valores existentes não-vazios, preenche nulos */
function mergeKeepExisting(existing, incoming) {
  const result = { ...existing }
  for (const [k, v] of Object.entries(incoming)) {
    if (isNullOrEmpty(existing[k])) {
      result[k] = v
    }
  }
  return result
}

async function logPipelineEvent(call_id, step, status, payload = {}) {
  if (DRY_RUN) return
  const { error } = await supabase.from('pipeline_events').insert({
    call_id,
    step,
    status,
    payload,
    duration_ms: 0,
  })
  if (error) console.warn(`pipeline_events insert failed: ${error.message}`)
}

// ── Core merge ────────────────────────────────────────────────────────────────

async function mergeAnalysis(callId, analysisJson) {
  const started = Date.now()

  // 1. Buscar estado atual da call
  const { data: callRow } = await supabase
    .from('calls')
    .select('id, status, transcript_text')
    .eq('id', callId)
    .maybeSingle()

  if (!callRow) {
    console.log(`  [SKIP] call not found: ${callId}`)
    return { callId, result: 'not_found' }
  }

  const changes = []

  // 2. Merge em call_analysis
  const spiced = analysisJson.spiced || null
  const spin = analysisJson.spin || null
  const challenger = analysisJson.challenger || null
  const consolidated = analysisJson.consolidated || null

  if (spiced || spin || challenger || consolidated) {
    const { data: existingCA } = await supabase
      .from('call_analysis')
      .select('*')
      .eq('call_id', callId)
      .maybeSingle()

    const incoming = {
      call_id: callId,
      spiced_summary: spiced?.summary || spiced || null,
      spin_summary: spin?.summary || spin || null,
      challenger_summary: challenger?.summary || challenger || null,
      summary: consolidated?.summary || null,
      risk_signals: consolidated?.risks || consolidated?.risk_signals || null,
      next_steps: consolidated?.next_steps || null,
      rag_sources: ['precomputed_analysis'],
      rag_last_updated_at: new Date().toISOString(),
    }

    if (!existingCA) {
      if (!DRY_RUN) {
        const { error } = await supabase.from('call_analysis').insert(incoming)
        if (error) console.warn(`  call_analysis insert error: ${error.message}`)
        else changes.push('call_analysis:created')
      } else {
        changes.push('call_analysis:would_create')
      }
    } else {
      const merged = mergeKeepExisting(existingCA, incoming)
      const diff = Object.keys(merged).filter(
        (k) => JSON.stringify(merged[k]) !== JSON.stringify(existingCA[k])
      )
      if (diff.length > 0) {
        if (!DRY_RUN) {
          const { error } = await supabase.from('call_analysis').update(merged).eq('call_id', callId)
          if (error) console.warn(`  call_analysis update error: ${error.message}`)
          else changes.push(`call_analysis:filled(${diff.join(',')})`)
        } else {
          changes.push(`call_analysis:would_fill(${diff.join(',')})`)
        }
      }
    }
  }

  // 3. Merge em framework_scores (spiced/spin/challenger scores)
  const frameworks = ['spiced', 'spin', 'challenger']
  for (const fw of frameworks) {
    const fwData = analysisJson[fw]
    if (!fwData || !fwData.scores) continue

    const { data: existingScore } = await supabase
      .from('framework_scores')
      .select('*')
      .eq('call_id', callId)
      .eq('framework', fw)
      .maybeSingle()

    const incoming = {
      call_id: callId,
      framework: fw,
      scores: fwData.scores,
      total_score: fwData.total_score || fwData.score || null,
      metadata: { origin: 'precomputed_analysis' },
    }

    if (!existingScore) {
      if (!DRY_RUN) {
        const { error } = await supabase.from('framework_scores').insert(incoming)
        if (error) console.warn(`  framework_scores(${fw}) insert error: ${error.message}`)
        else changes.push(`framework_scores:${fw}:created`)
      } else {
        changes.push(`framework_scores:${fw}:would_create`)
      }
    }
  }

  // 4. Merge behavior_signals
  const bsData = analysisJson.behavior_signals
  if (bsData && Array.isArray(bsData) && bsData.length > 0) {
    const { data: existingBS } = await supabase
      .from('behavior_signals')
      .select('id')
      .eq('call_id', callId)
      .limit(1)

    if (!existingBS || existingBS.length === 0) {
      const payload = bsData.map((sig) => ({
        call_id: callId,
        signal_type: sig.type || sig.signal_type || 'unknown',
        signal_value: sig.value || sig.signal_value || null,
        confidence: sig.confidence || null,
        metadata: { origin: 'precomputed_analysis', ...sig },
      }))
      if (!DRY_RUN) {
        const { error } = await supabase.from('behavior_signals').insert(payload)
        if (error) console.warn(`  behavior_signals insert error: ${error.message}`)
        else changes.push(`behavior_signals:created(${payload.length})`)
      } else {
        changes.push(`behavior_signals:would_create(${payload.length})`)
      }
    }
  }

  // 5. Registrar pipeline_event
  const duration_ms = Date.now() - started
  await logPipelineEvent(callId, 'merge_precomputed_analysis', 'success', {
    changes,
    origin: 'analises_prontas',
    duration_ms,
  })

  return { callId, result: changes.length > 0 ? 'merged' : 'noop', changes }
}

// ── Entry points ──────────────────────────────────────────────────────────────

async function runSingle(callId, dir) {
  // Achar arquivo de análise pelo call_id
  const files = dir ? fs.readdirSync(dir).filter((f) => f.includes(callId.slice(0, 8))) : []
  if (files.length === 0) {
    console.log(`No analysis file found for call_id ${callId}`)
    return
  }
  const filePath = path.join(dir, files[0])
  const analysisJson = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const result = await mergeAnalysis(callId, analysisJson)
  console.log(`${callId}: ${result.result}`, result.changes || '')
}

async function runAll(dir) {
  if (!dir || !fs.existsSync(dir)) {
    throw new Error(`Source dir not found: ${dir}`)
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('_analysis.json'))
  console.log(`Found ${files.length} analysis files in ${dir}${DRY_RUN ? ' (dry-run)' : ''}`)

  let merged = 0
  let noop = 0
  let not_found = 0

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8')
      const analysisJson = JSON.parse(raw)
      const callId = analysisJson.call_metadata?.call_id
      if (!callId) {
        console.log(`  [SKIP] no call_id in ${file}`)
        not_found++
        continue
      }
      const result = await mergeAnalysis(callId, analysisJson)
      if (result.result === 'merged') { merged++; console.log(`  [MERGED] ${callId} — ${result.changes.join(', ')}`) }
      else if (result.result === 'noop') noop++
      else not_found++
    } catch (e) {
      console.warn(`  [ERROR] ${file}: ${e.message}`)
    }
  }

  console.log(`\nDone. merged=${merged}, noop=${noop}, not_found=${not_found}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
if (ALL_MODE) {
  runAll(SOURCE_DIR).catch((e) => { console.error(e); process.exit(1) })
} else if (SINGLE_CALL_ID) {
  runSingle(SINGLE_CALL_ID, SOURCE_DIR).catch((e) => { console.error(e); process.exit(1) })
} else {
  console.error('Usage: node merge-precomputed-analysis.js <call_id> | --all --dir <path>')
  process.exit(1)
}
