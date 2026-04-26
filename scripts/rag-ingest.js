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

function walkFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(full, out)
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

  const docs = await splitter.createDocuments([raw], [{ source: relPath }])
  const chunks = docs.map((d) => d.pageContent.trim()).filter(Boolean)
  if (chunks.length === 0) return { file: relPath, chunks: 0, checksum }

  if (DRY_RUN) {
    return { file: relPath, chunks: chunks.length, checksum }
  }

  const uploadPath = `ingested/${relPath}`
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
      metadata: { ext: path.extname(filePath).toLowerCase() },
    })
    .select('id')
    .single()
  if (fileError) throw fileError

  const vectors = await embeddings.embedDocuments(chunks)

  const payload = chunks.map((content, idx) => ({
    file_id: fileRow.id,
    source: relPath,
    chunk_index: idx,
    content,
    token_count: Math.ceil(content.length / 4),
    metadata: {},
    embedding: toPgVector(vectors[idx]),
  }))

  const { error: chunkError } = await supabase.from('knowledge_chunks').insert(payload)
  if (chunkError) throw chunkError

  return { file: relPath, chunks: chunks.length }
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
  for (const file of files) {
    const result = await ingestFile(file)
    totalChunks += result.chunks
    console.log(`${DRY_RUN ? 'Validated' : 'Ingested'} ${result.file} (${result.chunks} chunks)`)
  }

  console.log(`${DRY_RUN ? 'Dry-run done' : 'Done'}. Files: ${files.length}, chunks: ${totalChunks}`)
}

main().catch((err) => {
  console.error('RAG ingest failed:', err)
  process.exit(1)
})
