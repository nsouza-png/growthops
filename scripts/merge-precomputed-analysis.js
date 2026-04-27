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
const MODE = (process.env.MODE || '').toLowerCase()

if (MODE === 'skills_only') {
  console.error('[guardrail] MODE=skills_only blocks merge:analysis execution.')
  process.exit(1)
}

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

function pickNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function pickScore(obj, key) {
  if (!obj || typeof obj !== 'object') return null
  const item = obj[key]
  if (item && typeof item === 'object' && 'score' in item) return pickNumber(item.score)
  return pickNumber(item)
}

function buildSparsePatch(existing, incoming) {
  const patch = {}
  for (const [k, v] of Object.entries(incoming)) {
    if (v === null || v === undefined) continue
    if (isNullOrEmpty(existing[k])) patch[k] = v
  }
  return patch
}

async function logPipelineEvent(call_id, step, status) {
  if (DRY_RUN) return
  const { error } = await supabase.from('pipeline_events').insert({
    call_id,
    step,
    status,
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
      summary_text:
        consolidated?.summary ||
        spiced?.summary ||
        spin?.summary ||
        challenger?.summary ||
        null,
      client_pains: consolidated?.client_pains || consolidated?.pains || null,
      next_steps: consolidated?.next_steps || consolidated?.deal_next_steps || null,
      objections: consolidated?.objections || null,
      churn_signals: consolidated?.risks || consolidated?.risk_signals || null,
      buy_intent_signals: consolidated?.buy_intent_signals || null,
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
      const patch = buildSparsePatch(existingCA, incoming)
      const diff = Object.keys(patch)
      if (diff.length > 0) {
        if (!DRY_RUN) {
          const { error } = await supabase.from('call_analysis').update(patch).eq('call_id', callId)
          if (error) console.warn(`  call_analysis update error: ${error.message}`)
          else changes.push(`call_analysis:filled(${diff.join(',')})`)
        } else {
          changes.push(`call_analysis:would_fill(${diff.join(',')})`)
        }
      }
    }
  }

  // 3. Merge em framework_scores (spiced/spin/challenger scores)
  const { data: existingScore } = await supabase
    .from('framework_scores')
    .select('*')
    .eq('call_id', callId)
    .maybeSingle()

  const spicedScores = analysisJson.spiced?.scores || {}
  const spinScores = analysisJson.spin?.scores || {}
  const challengerScores = analysisJson.challenger?.scores || {}
  const incomingScores = {
    call_id: callId,
    spiced_situation: pickScore(spicedScores, 'situation'),
    spiced_pain: pickScore(spicedScores, 'pain'),
    spiced_impact: pickScore(spicedScores, 'impact'),
    spiced_critical_event: pickScore(spicedScores, 'critical_event'),
    spiced_decision: pickScore(spicedScores, 'decision'),
    spiced_total: pickNumber(analysisJson.spiced?.score_total),
    spin_situation: pickScore(spinScores, 'situation'),
    spin_problem: pickScore(spinScores, 'problem'),
    spin_implication: pickScore(spinScores, 'implication'),
    spin_need_payoff: pickScore(spinScores, 'need_payoff'),
    spin_total: pickNumber(analysisJson.spin?.score_total),
    challenger_teach: pickScore(challengerScores, 'teach'),
    challenger_tailor: pickScore(challengerScores, 'tailor'),
    challenger_take_control: pickScore(challengerScores, 'take_control'),
    challenger_total: pickNumber(analysisJson.challenger?.score_total),
  }
  if (!existingScore) {
    if (!DRY_RUN) {
      const { error } = await supabase.from('framework_scores').insert(incomingScores)
      if (error) console.warn(`  framework_scores insert error: ${error.message}`)
      else changes.push('framework_scores:created')
    } else {
      changes.push('framework_scores:would_create')
    }
  } else {
    const scorePatch = buildSparsePatch(existingScore, incomingScores)
    if (Object.keys(scorePatch).length > 0) {
      if (!DRY_RUN) {
        const { error } = await supabase.from('framework_scores').update(scorePatch).eq('call_id', callId)
        if (error) console.warn(`  framework_scores update error: ${error.message}`)
        else changes.push(`framework_scores:filled(${Object.keys(scorePatch).join(',')})`)
      } else {
        changes.push(`framework_scores:would_fill(${Object.keys(scorePatch).join(',')})`)
      }
    }
  }

  // 4. Registrar pipeline_event
  await logPipelineEvent(callId, 'merge_precomputed_analysis', 'success')

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
