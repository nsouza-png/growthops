import { corsHeaders, errorResponse, getSupabaseClient, jsonResponse } from '../_shared/supabase.ts'
import OpenAI from 'https://esm.sh/openai@4.71.1'
import { logStep, nowMs } from '../_shared/observability.ts'

function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

function chunkText(input: string, chunkSize: number, overlap: number): string[] {
  const text = input.trim()
  if (!text) return []
  const safeOverlap = Math.max(0, Math.min(overlap, Math.max(chunkSize - 1, 0)))
  const step = Math.max(1, chunkSize - safeOverlap)
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += step) {
    const part = text.slice(i, i + chunkSize).trim()
    if (part) chunks.push(part)
    if (i + chunkSize >= text.length) break
  }
  return chunks
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }

  try {
    const startedAt = nowMs()
    const { call_id, chunkSize = 500, chunkOverlap = 150, auto_enrich = true } = await req.json()
    if (!call_id || typeof call_id !== 'string') {
      return errorResponse('call_id is required', 400)
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return errorResponse('OPENAI_API_KEY not configured', 500)

    const supabase = getSupabaseClient()
    const openai = new OpenAI({ apiKey })
    logStep({ function_name: 'rag-index-transcript', call_id, step: 'start', status: 'start' })

    const { data: call, error: callErr } = await supabase
      .from('calls')
      .select('id, tldv_call_id, transcript_text')
      .eq('id', call_id)
      .single()
    if (callErr || !call) return errorResponse('call not found', 404)
    if (!call.transcript_text || call.transcript_text.trim().length === 0) {
      return errorResponse('transcript_text is empty for call', 400)
    }

    const { data: lockRows } = await supabase
      .from('calls')
      .update({
        rag_index_status: 'indexing',
        rag_index_started_at: new Date().toISOString(),
      })
      .eq('id', call_id)
      .in('rag_index_status', ['idle', 'failed', 'indexed'])
      .select('id')

    if (!lockRows || lockRows.length === 0) {
      logStep({
        function_name: 'rag-index-transcript',
        call_id,
        step: 'lock',
        status: 'skip',
        duration_ms: nowMs() - startedAt,
        details: { reason: 'already_indexing' },
      })
      return jsonResponse({ ok: true, call_id, skipped: true, reason: 'already_indexing' })
    }

    const source = `call:${call_id}:transcript`
    const chunks = chunkText(call.transcript_text, Number(chunkSize), Number(chunkOverlap))
    if (chunks.length === 0) return errorResponse('no chunks generated from transcript', 400)

    const { data: existingFiles } = await supabase
      .from('knowledge_files')
      .select('id')
      .eq('source', source)

    if (existingFiles && existingFiles.length > 0) {
      const ids = existingFiles.map((f: { id: string }) => f.id)
      await supabase.from('knowledge_files').delete().in('id', ids)
    }

    const { data: fileRow, error: fileErr } = await supabase
      .from('knowledge_files')
      .insert({
        source,
        bucket: 'calls-transcript',
        storage_path: source,
        metadata: {
          kind: 'call_transcript',
          call_id,
          tldv_call_id: call.tldv_call_id ?? null,
          chunk_size: Number(chunkSize),
          chunk_overlap: Number(chunkOverlap),
        },
      })
      .select('id')
      .single()
    if (fileErr || !fileRow) return errorResponse(`failed to insert knowledge_file: ${fileErr?.message}`, 500)

    const vectors = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunks,
    })
    const embeddings = vectors.data.map((d) => d.embedding)

    const rows = chunks.map((content, i) => ({
      file_id: fileRow.id,
      source,
      chunk_index: i,
      content,
      token_count: Math.ceil(content.length / 4),
      metadata: { call_id, kind: 'call_transcript_chunk' },
      embedding: toPgVector(embeddings[i]),
    }))

    const { error: chunksErr } = await supabase.from('knowledge_chunks').insert(rows)
    if (chunksErr) {
      await supabase.from('calls').update({ rag_index_status: 'failed' }).eq('id', call_id)
      return errorResponse(`failed to insert knowledge_chunks: ${chunksErr.message}`, 500)
    }

    await supabase.from('calls').update({ rag_index_status: 'indexed' }).eq('id', call_id)

    if (auto_enrich) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      fetch(`${supabaseUrl}/functions/v1/rag-enrich-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ call_id }),
      }).catch((err) => console.error('[rag-index-transcript] failed to invoke rag-enrich-call', err))
    }

    logStep({
      function_name: 'rag-index-transcript',
      call_id,
      step: 'index',
      status: 'ok',
      duration_ms: nowMs() - startedAt,
      details: { chunks: chunks.length, chunk_size: Number(chunkSize), chunk_overlap: Number(chunkOverlap) },
    })
    return jsonResponse({
      ok: true,
      call_id,
      source,
      chunks: chunks.length,
      chunk_size: Number(chunkSize),
      chunk_overlap: Number(chunkOverlap),
    })
  } catch (err) {
    logStep({
      function_name: 'rag-index-transcript',
      step: 'index',
      status: 'error',
      details: { message: err instanceof Error ? err.message : 'Unexpected error' },
    })
    console.error('[rag-index-transcript] error', err)
    return errorResponse(err instanceof Error ? err.message : 'Unexpected error', 500)
  }
})
