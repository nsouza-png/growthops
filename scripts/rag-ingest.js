/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters')
const { OpenAIEmbeddings } = require('@langchain/openai')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const RAG_BUCKET = process.env.RAG_BUCKET || 'rag-files'
const CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE || 500)
const CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP || 150)
const argv = process.argv.slice(2)
const SOURCE_ARG = argv.find((arg) => !arg.startsWith('-'))
const SOURCE_DIR = SOURCE_ARG || process.env.RAG_SOURCE_DIR || path.resolve(__dirname, '..', '..', 'skills')
const DRY_RUN = process.argv.includes('--dry-run') || process.env.RAG_DRY_RUN === '1'

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY)) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY')
  process.exit(1)
}

const supabase = DRY_RUN
  ? null
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      db: { schema: 'GrowthPlatform' },
    })

const embeddings = DRY_RUN
  ? null
  : new OpenAIEmbeddings({
      openAIApiKey: OPENAI_API_KEY,
      model: 'text-embedding-3-small',
    })

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
})

const ALLOWED_EXT = new Set(['.md', '.txt', '.json', '.csv'])

const SKIP_DIRS = new Set(['_erros', '_errors', 'node_modules', '.git'])

// Mapa canônico seller_name -> seller_email (corrige emails de organizador errados)
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

/**
 * Extrai metadata enriquecida de um arquivo de análise JSON.
 * Retorna null se o arquivo não for uma análise de call G4.
 */
function extractAnalysisMetadata(filePath, raw) {
  try {
    const ext = path.extname(filePath).toLowerCase()
    if (ext !== '.json') return { ext, origin: 'knowledge_base' }

    const parsed = JSON.parse(raw)

    // Detecta se é arquivo de análise de call G4
    if (!parsed.call_metadata && !parsed._call_raw) {
      return { ext, origin: 'knowledge_base' }
    }

    const meta = parsed.call_metadata || {}
    const raw_call = parsed._call_raw || {}

    const seller_name = meta.seller_name || raw_call.nome_organizador || null
    const seller_email = seller_name
      ? (SELLER_EMAIL_MAP[seller_name] || raw_call.email || raw_call.email_organizador || null)
      : (raw_call.email || raw_call.email_organizador || null)

    const call_id = meta.call_id || raw_call.id || null
    const tldv_call_id = meta.tldv_call_id || raw_call.tldv_call_id || null
    const call_date = meta.call_date || raw_call.date || null
    const data_source = meta.data_source || raw_call.data_source || null
    const squad = meta.squad || meta.team || raw_call.squad || null
    const duration_min = meta.duration_min || raw_call.duracao_min || null

    const mapped = !!(seller_email || call_id)

    return {
      ext,
      origin: 'analises_prontas',
      seller_name,
      seller_email,
      call_id,
      tldv_call_id,
      call_date,
      data_source,
      squad,
      duration_min,
      mapped,
      unmapped: !mapped,
      ingested_at: new Date().toISOString(),
    }
  } catch {
    return { ext: path.extname(filePath).toLowerCase(), origin: 'knowledge_base', parse_error: true }
  }
}

function walkFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkFiles(full, out)
    } else if (ALLOWED_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full)
    }
  }
  return out
}

function toPgVector(arr) {
  return `[${arr.join(',')}]`
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

async function ensureBucket() {
  if (DRY_RUN) return
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw error
  if (!buckets.some((b) => b.name === RAG_BUCKET)) {
    const { error: createError } = await supabase.storage.createBucket(RAG_BUCKET, { public: false })
    if (createError) throw createError
  }
}

async function ingestFile(filePath) {
  const relPath = path.relative(SOURCE_DIR, filePath).replace(/\\/g, '/')
  const raw = fs.readFileSync(filePath, 'utf8')
  const checksum = sha256(raw)
  const fileMeta = extractAnalysisMetadata(filePath, raw)

  const docs = await splitter.createDocuments([raw], [{ source: relPath }])
  const chunks = docs.map((d) => d.pageContent.trim()).filter(Boolean)
  if (chunks.length === 0) return { file: relPath, chunks: 0, checksum }

  if (DRY_RUN) {
    return { file: relPath, chunks: chunks.length, checksum, meta: fileMeta }
  }

  // Deduplication: skip if checksum already exists
  const { data: existing } = await supabase
    .from('knowledge_files')
    .select('id')
    .eq('checksum', checksum)
    .maybeSingle()
  if (existing) {
    return { file: relPath, chunks: 0, skipped: true }
  }

  const safeRelPath = relPath.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._\-/]/g, '_')
  const uploadPath = `ingested/${safeRelPath}`
  const { error: uploadError } = await supabase.storage
    .from(RAG_BUCKET)
    .upload(uploadPath, Buffer.from(raw, 'utf8'), {
      contentType: 'text/plain; charset=utf-8',
      upsert: true,
    })
  if (uploadError) throw uploadError

  const { data: fileRow, error: fileError } = await supabase
    .from('knowledge_files')
    .insert({
      source: relPath,
      bucket: RAG_BUCKET,
      storage_path: uploadPath,
      checksum,
      metadata: fileMeta,
    })
    .select('id')
    .single()
  if (fileError) throw fileError

  const vectors = await embeddings.embedDocuments(chunks)

  const chunkMeta = fileMeta.origin === 'analises_prontas'
    ? {
        origin: fileMeta.origin,
        seller_email: fileMeta.seller_email || null,
        squad: fileMeta.squad || null,
        call_id: fileMeta.call_id || null,
      }
    : {}

  const payload = chunks.map((content, idx) => ({
    file_id: fileRow.id,
    source: relPath,
    chunk_index: idx,
    content,
    token_count: Math.ceil(content.length / 4),
    metadata: chunkMeta,
    embedding: toPgVector(vectors[idx]),
  }))

  const { error: chunkError } = await supabase.from('knowledge_chunks').insert(payload)
  if (chunkError) throw chunkError

  return { file: relPath, chunks: chunks.length, meta: fileMeta }
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Source dir not found: ${SOURCE_DIR}`)
  }

  await ensureBucket()
  const files = walkFiles(SOURCE_DIR)
  console.log(`Found ${files.length} files in ${SOURCE_DIR}${DRY_RUN ? ' (dry-run)' : ''}`)
  console.log(`Chunking config: size=${CHUNK_SIZE}, overlap=${CHUNK_OVERLAP}`)

  let totalChunks = 0
  let totalMapped = 0
  let totalUnmapped = 0
  let totalSkipped = 0

  for (const file of files) {
    const result = await ingestFile(file)
    totalChunks += result.chunks
    if (result.skipped) {
      totalSkipped++
      console.log(`Skipped (already ingested): ${result.file}`)
    } else {
      if (result.meta?.mapped) totalMapped++
      if (result.meta?.unmapped) totalUnmapped++
      console.log(`${DRY_RUN ? 'Validated' : 'Ingested'} ${result.file} (${result.chunks} chunks)${result.meta?.seller_email ? ' seller=' + result.meta.seller_email : ''}`)
    }
  }

  console.log(`${DRY_RUN ? 'Dry-run done' : 'Done'}. Files: ${files.length}, chunks: ${totalChunks}, mapped: ${totalMapped}, unmapped: ${totalUnmapped}, skipped: ${totalSkipped}`)
}

main().catch((err) => {
  console.error('RAG ingest failed:', err)
  process.exit(1)
})
