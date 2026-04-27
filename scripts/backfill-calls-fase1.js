/* eslint-disable no-console */
/**
 * backfill-calls-fase1.js
 *
 * Fase 1: popula GrowthPlatform.calls a partir dos históricos locais.
 * Idempotente — upsert por call_id (campo id na tabela).
 * Não sobrescreve campos não-nulos existentes.
 * Gera artefato de mapeamento JSON e relatório .md.
 *
 * Uso:
 *   node scripts/backfill-calls-fase1.js [--dry-run] [--batch-size 200]
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const batchIdx = argv.indexOf('--batch-size')
const BATCH_SIZE = batchIdx !== -1 ? Number(argv[batchIdx + 1]) : 200
const MODE = (process.env.MODE || '').toLowerCase()

const CALLS_DIR = process.env.CALLS_DIR ||
  'C:\\Users\\n.souza_g4educacao\\Documents\\G4OS GROWTH OPS FULL\\estudos\\analises-calls\\calls_extraidas'
const ANALISES_DIR = process.env.ANALISES_DIR ||
  'C:\\Users\\n.souza_g4educacao\\Documents\\G4OS GROWTH OPS FULL\\estudos\\analises-calls\\analises'

const REPORT_PATH = path.join(
  'C:\\Users\\n.souza_g4educacao\\Documents\\G4OS GROWTH OPS FULL\\Projects\\growthops-main',
  'BACKFILL-CALLS-FASE1-RELATORIO.md'
)
const MAPPING_PATH = path.join(
  'C:\\Users\\n.souza_g4educacao\\Documents\\G4OS GROWTH OPS FULL\\Projects\\growthops-main',
  'backfill-calls-fase1-mapping.json'
)

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (MODE === 'skills_only') {
  console.error('[guardrail] MODE=skills_only blocks backfill:calls execution.')
  process.exit(1)
}

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'GrowthPlatform' },
})

// ── Mapa canônico seller_name -> seller_email ─────────────────────────────────
const SELLER_EMAIL_MAP = {
  'Aline Hipólito': 'a.hipolito@g4educacao.com',
  'Júnior Cruz': 'j.cruz@g4educacao.com',
  'João Resende': 'j.resende@g4educacao.com',
  'Laura Zacharczuk': 'l.zacharczuk@g4educacao.com',
  'Mathias Alves': 'm.t.alves@g4educacao.com',
  'Augusto Rebouças': 'a.reboucas@g4educacao.com',
  'Joanna Farias': 'j.farias@g4educacao.com',
  'Yuri Rimkus': 'y.rimkus@g4educacao.com',
  'Felice Napolitano': 'f.napolitano@g4educacao.com',
  'Carolina Lopes': 'carolina.lopes@g4educacao.com',
  'Lucas Tavares': 'lucas.tavares@g4educacao.com',
  'Rafael Pradal': 'r.pradal@g4educacao.com',
  'Patrick Ribeiro': 'patrick.ribeiro@g4educacao.com',
  'João Rodrigues': 'joao.rodrigues@g4educacao.com',
  'James Quatrini': 'j.quatrini@g4educacao.com',
  'Felipe de Paula': 'f.depaula@g4educacao.com',
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseCallFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const d = JSON.parse(raw)
    const callId = d.id || null
    const sellerName = d.nome_organizador || null
    const sellerEmail = (d.email_organizador || '').toLowerCase().trim() ||
      (sellerName ? SELLER_EMAIL_MAP[sellerName] : null)
    const callDate = d.date ? new Date(d.date).toISOString() : null
    const transcript = d.transcricao || null
    const duration = d.duracao_min ? d.duracao_min * 60 : null
    const dataSource = d.data_source || 'historical_backfill'
    const prospectName = d.nome_ev || null

    if (!callId) return { callId: null, status: 'unmapped', reason: 'no_call_id', file: path.basename(filePath) }

    return {
      callId,
      sellerName,
      sellerEmail: sellerEmail || null,
      callDate,
      transcript,
      duration,
      dataSource,
      prospectName,
      sourceFile: path.basename(filePath),
      matchMethod: 'call_id_explicit',
      confidence: 1.0,
      status: sellerEmail ? 'mapped' : 'mapped_partial',
    }
  } catch (e) {
    return { callId: null, status: 'error', reason: e.message, file: path.basename(filePath) }
  }
}

function parseAnalysisFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const d = JSON.parse(raw)
    const meta = d.call_metadata || {}
    const rawCall = d._call_raw || {}

    const callId = meta.call_id || rawCall.id || null
    const sellerName = meta.seller_name || null
    const sellerEmail = sellerName
      ? (SELLER_EMAIL_MAP[sellerName] || (rawCall.email || '').toLowerCase().trim() || null)
      : (rawCall.email || '').toLowerCase().trim() || null
    const callDate = meta.call_date ? new Date(meta.call_date).toISOString() : null
    const duration = meta.duration_min ? meta.duration_min * 60 : null
    const dataSource = meta.data_source || 'call_executivo'
    const prospectName = meta.prospect_name || null
    const tldvCallId = meta.tldv_call_id || null

    if (!callId) return { callId: null, status: 'unmapped', reason: 'no_call_id', file: path.basename(filePath) }

    return {
      callId,
      tldvCallId,
      sellerName,
      sellerEmail,
      callDate,
      duration,
      dataSource,
      prospectName,
      sourceFile: path.basename(filePath),
      matchMethod: tldvCallId ? 'tldv_call_id' : 'call_id_explicit',
      confidence: 1.0,
      status: sellerEmail ? 'mapped' : 'mapped_partial',
      hasAnalysis: true,
    }
  } catch (e) {
    return { callId: null, status: 'error', reason: e.message, file: path.basename(filePath) }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Backfill Fase 1 — ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`)
  console.log(`Batch size: ${BATCH_SIZE}`)

  // 1. Parse todos os arquivos
  const callFiles = fs.readdirSync(CALLS_DIR).filter(f => f.endsWith('.json'))
  const analysisFiles = fs.readdirSync(ANALISES_DIR).filter(f => f.endsWith('_analysis.json'))

  console.log(`\nFontes: ${callFiles.length} transcrições, ${analysisFiles.length} análises`)

  // Mapa callId -> registro combinado (transcrição + análise)
  const byCallId = new Map()
  const mappingLog = []
  let errors = 0

  // Parse transcrições (fonte primária — tem transcript_text)
  for (const f of callFiles) {
    const parsed = parseCallFile(path.join(CALLS_DIR, f))
    if (parsed.status === 'error') { errors++; mappingLog.push(parsed); continue }
    if (!parsed.callId) { mappingLog.push({ ...parsed, status: 'unmapped' }); continue }

    byCallId.set(parsed.callId, {
      id: parsed.callId,
      seller_email: parsed.sellerEmail,
      seller_name: parsed.sellerName,
      call_date: parsed.callDate,
      transcript_text: parsed.transcript,
      duration_seconds: parsed.duration,
      data_source: parsed.dataSource,
      prospect_name: parsed.prospectName,
      processing_status: 'backfilled',
      transcript_fetched: !!parsed.transcript,
      _meta: { sourceFile: parsed.sourceFile, matchMethod: parsed.matchMethod, confidence: parsed.confidence },
    })
    mappingLog.push({ sourceFile: parsed.sourceFile, callId: parsed.callId, matchMethod: parsed.matchMethod, confidence: parsed.confidence, status: parsed.status })
  }

  // Parse análises — enriquecer registros existentes ou criar novos
  for (const f of analysisFiles) {
    const parsed = parseAnalysisFile(path.join(ANALISES_DIR, f))
    if (parsed.status === 'error') { errors++; mappingLog.push(parsed); continue }
    if (!parsed.callId) { mappingLog.push({ ...parsed, status: 'unmapped' }); continue }

    const existing = byCallId.get(parsed.callId)
    if (existing) {
      // Enriquecer campos nulos do registro de transcrição
      if (!existing.tldv_call_id && parsed.tldvCallId) existing.tldv_call_id = parsed.tldvCallId
      if (!existing.seller_email && parsed.sellerEmail) existing.seller_email = parsed.sellerEmail
      if (!existing.prospect_name && parsed.prospectName) existing.prospect_name = parsed.prospectName
    } else {
      // Criar entry só com dados da análise (sem transcript)
      byCallId.set(parsed.callId, {
        id: parsed.callId,
        tldv_call_id: parsed.tldvCallId || null,
        seller_email: parsed.sellerEmail,
        seller_name: parsed.sellerName,
        call_date: parsed.callDate,
        transcript_text: null,
        duration_seconds: parsed.duration,
        data_source: parsed.dataSource,
        prospect_name: parsed.prospectName,
        processing_status: 'backfilled',
        transcript_fetched: false,
        _meta: { sourceFile: parsed.sourceFile, matchMethod: parsed.matchMethod, confidence: parsed.confidence },
      })
    }

    const logEntry = mappingLog.find(m => m.callId === parsed.callId)
    if (!logEntry) {
      mappingLog.push({ sourceFile: parsed.sourceFile, callId: parsed.callId, matchMethod: parsed.matchMethod, confidence: parsed.confidence, status: parsed.status })
    }
  }

  const records = Array.from(byCallId.values())
  const mapped = mappingLog.filter(m => m.status === 'mapped' || m.status === 'mapped_partial').length
  const unmapped = mappingLog.filter(m => m.status === 'unmapped').length
  const conflicts = mappingLog.filter(m => m.status === 'conflict').length

  console.log(`\nRegistros únicos a inserir: ${records.length}`)
  console.log(`Mapeados: ${mapped} | Unmapped: ${unmapped} | Conflito: ${conflicts} | Erros: ${errors}`)

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] Nenhum dado gravado.')
    console.log('Amostra (5 primeiros):')
    records.slice(0, 5).forEach(r => {
      console.log(`  ${r.id} | ${r.seller_email} | ${r.call_date?.slice(0,10)} | transcript=${!!r.transcript_text}`)
    })
    await writeReport({ records, mappingLog, mapped, unmapped, conflicts, errors, created: 0, updated: 0, skipped: 0, dryRun: true })
    return
  }

  // 2. Buscar IDs já existentes para não sobrescrever
  console.log('\nBuscando calls existentes no banco...')
  const { data: existingRows } = await supabase.from('calls').select('id, seller_email, processing_status')
  const existingIds = new Set((existingRows || []).map(r => r.id))
  console.log(`Já existentes: ${existingIds.size}`)

  // 3. Processar em batches
  let created = 0, updated = 0, skipped = 0, batchErrors = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const toInsert = []
    const toUpdate = []

    for (const rec of batch) {
      const { _meta, ...row } = rec
      if (existingIds.has(row.id)) {
        // Só atualizar campos nulos
        toUpdate.push(row)
      } else {
        toInsert.push(row)
      }
    }

    // Insert novos
    if (toInsert.length > 0) {
      const { error } = await supabase.from('calls').insert(toInsert)
      if (error) {
        console.error(`Batch insert error (i=${i}): ${error.message}`)
        batchErrors += toInsert.length
      } else {
        created += toInsert.length
        console.log(`  Batch ${Math.floor(i/BATCH_SIZE)+1}: inserted ${toInsert.length}`)
      }
    }

    // Upsert existentes (apenas campos nulos — usar upsert com ignoreDuplicates=false e merge parcial)
    for (const row of toUpdate) {
      const { data: curr } = await supabase.from('calls').select('*').eq('id', row.id).single()
      if (!curr) { skipped++; continue }

      const patch = {}
      for (const [k, v] of Object.entries(row)) {
        if (v !== null && v !== undefined && (curr[k] === null || curr[k] === undefined || curr[k] === '')) {
          patch[k] = v
        }
      }

      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from('calls').update(patch).eq('id', row.id)
        if (error) { console.warn(`  update error ${row.id}: ${error.message}`); batchErrors++ }
        else updated++
      } else {
        skipped++
      }
    }

    // Checkpoint por batch
    const pct = Math.round((Math.min(i + BATCH_SIZE, records.length) / records.length) * 100)
    console.log(`  Progress: ${pct}% (${Math.min(i + BATCH_SIZE, records.length)}/${records.length})`)
  }

  console.log(`\n✓ Criadas: ${created} | Atualizadas: ${updated} | Puladas: ${skipped} | Erros: ${batchErrors}`)

  await writeReport({ records, mappingLog, mapped, unmapped, conflicts, errors, created, updated, skipped, dryRun: false })
  fs.writeFileSync(MAPPING_PATH, JSON.stringify(mappingLog, null, 2), 'utf8')
  console.log(`\nRelatório: ${REPORT_PATH}`)
  console.log(`Mapeamento: ${MAPPING_PATH}`)
}

async function writeReport({ records, mappingLog, mapped, unmapped, conflicts, errors, created, updated, skipped, dryRun }) {
  const total = mappingLog.length
  const coverage = total > 0 ? ((mapped / total) * 100).toFixed(1) : 0
  const withTranscript = records.filter(r => r.transcript_text && r.transcript_text.length > 10).length
  const now = new Date().toISOString()

  const unmappedList = mappingLog.filter(m => m.status === 'unmapped').slice(0, 20)
  const conflictList = mappingLog.filter(m => m.status === 'conflict').slice(0, 20)
  const sample = mappingLog.filter(m => m.callId).slice(0, 20)

  const md = `# BACKFILL-CALLS-FASE1 — Relatório
Gerado em: ${now}
Modo: ${dryRun ? 'DRY-RUN (nenhum dado gravado)' : 'LIVE'}

## Resumo executivo
| Métrica | Valor |
|---|---|
| Arquivos lidos (transcrições) | ${records.length} |
| Arquivos lidos (análises) | ${mappingLog.filter(m=>m.sourceFile?.includes('analysis')).length} |
| Total mapeamentos | ${total} |
| Mapped | ${mapped} |
| Unmapped | ${unmapped} |
| Conflict | ${conflicts} |
| Parse errors | ${errors} |
| **Cobertura** | **${coverage}%** |
| Calls criadas | ${created} |
| Calls atualizadas | ${updated} |
| Calls puladas (já existiam OK) | ${skipped} |
| Calls com transcript | ${withTranscript} |

## Validação SQL (executar após backfill)
\`\`\`sql
-- 1. Total de calls
select count(*) as total_calls from "GrowthPlatform".calls;

-- 2. Por data_source
select data_source, count(*) as qty
from "GrowthPlatform".calls
group by data_source order by qty desc;

-- 3. Calls com transcript
select
  count(*) filter (where transcript_text is not null and length(trim(transcript_text)) > 0) as calls_with_transcript,
  count(*) as total_calls
from "GrowthPlatform".calls;

-- 4. Por processing_status
select processing_status, count(*)
from "GrowthPlatform".calls
group by processing_status order by count(*) desc;
\`\`\`

## Amostra de mapeamentos (20 registros)
| source_file | call_id | método | confiança | status |
|---|---|---|---|---|
${sample.map(m => `| ${m.sourceFile} | ${m.callId} | ${m.matchMethod} | ${m.confidence} | ${m.status} |`).join('\n')}

## Unmapped (${unmappedList.length} listados)
${unmappedList.length === 0 ? '_Nenhum_' : unmappedList.map(m => `- \`${m.file || m.sourceFile}\`: ${m.reason || 'sem call_id'}`).join('\n')}

## Conflitos (${conflictList.length} listados)
${conflictList.length === 0 ? '_Nenhum_' : conflictList.map(m => `- \`${m.sourceFile}\`: ${m.reason}`).join('\n')}

## Riscos para Fase 2
1. **calls sem transcript** (${records.length - withTranscript} calls): analyze-call e rag-index-transcript dependerão de busca no tl;dv API.
2. **seller_email do organizador ≠ seller real** em ~30% dos arquivos — mapa canônico aplicado mas sellers não mapeados precisam revisão manual.
3. **squad nulo** em 100% das calls: necessário vincular por regra de negócio (seller_email → squad) antes do PDI.
4. **calls duplicadas por data** possível se mesmo seller teve 2+ calls no mesmo dia — call_id como PK previne, mas análises podem divergir.
5. **Ingestão RAG paralela em andamento** — knowledge_chunks ainda crescendo, rag-enrich-call pode retornar resultados incompletos até término.
`

  fs.writeFileSync(REPORT_PATH, md, 'utf8')
}

main().catch(e => { console.error(e); process.exit(1) })
