import { corsHeaders, errorResponse, getSupabaseClient, jsonResponse } from '../_shared/supabase.ts'
import OpenAI from 'https://esm.sh/openai@4.71.1'
import { logStep, nowMs } from '../_shared/observability.ts'

function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }

  try {
    const startedAt = nowMs()
    const {
      call_id,
      topK,
      prompt = 'Com base na transcrição, gere um resumo objetivo da call, principais dores do cliente, riscos, próximos passos e recomendação prática para o closer.',
    } = await req.json()

    if (!call_id || typeof call_id !== 'string') {
      return errorResponse('call_id is required', 400)
    }
    const defaultTopK = Number(Deno.env.get('RAG_MATCH_TOP_K_DEFAULT') ?? '8')
    const capTopK = Number(Deno.env.get('RAG_MATCH_TOP_K_CAP') ?? '12')
    const cap = Math.max(1, Math.min(Number.isFinite(capTopK) ? capTopK : 12, 16))
    const base = Number.isFinite(defaultTopK) && defaultTopK > 0 ? defaultTopK : 8
    const normalizedTopK = Math.max(1, Math.min(Number(topK) || base, cap))

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return errorResponse('OPENAI_API_KEY not configured', 500)

    const openai = new OpenAI({ apiKey })
    const supabase = getSupabaseClient()
    const source = `call:${call_id}:transcript`
    logStep({ function_name: 'rag-enrich-call', call_id, step: 'start', status: 'start' })

    const { data: lockRows } = await supabase
      .from('calls')
      .update({
        rag_enrich_status: 'enriching',
        rag_enrich_started_at: new Date().toISOString(),
      })
      .eq('id', call_id)
      .in('rag_enrich_status', ['idle', 'failed', 'enriched'])
      .select('id')
    if (!lockRows || lockRows.length === 0) {
      logStep({
        function_name: 'rag-enrich-call',
        call_id,
        step: 'lock',
        status: 'skip',
        duration_ms: nowMs() - startedAt,
        details: { reason: 'already_enriching' },
      })
      return jsonResponse({ ok: true, call_id, skipped: true, reason: 'already_enriching' })
    }

    const embeddingResp = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: prompt,
    })
    const queryEmbedding = embeddingResp.data[0]?.embedding
    if (!queryEmbedding) return errorResponse('failed to generate query embedding', 500)

    const { data: matches, error: matchError } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: toPgVector(queryEmbedding),
      match_count: normalizedTopK,
      source_filter: source,
    })
    if (matchError) {
      await supabase.from('calls').update({ rag_enrich_status: 'failed' }).eq('id', call_id)
      return errorResponse(`match_knowledge_chunks failed: ${matchError.message}`, 500)
    }

    const context = (matches ?? [])
      .map((m: { source: string; content: string }, idx: number) => `[#${idx + 1}] (${m.source})\n${m.content}`)
      .join('\n\n---\n\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content:
            'Você é um assistente comercial. Responda com objetividade e apenas com base no contexto recuperado. Se faltar evidência, declare explicitamente.',
        },
        {
          role: 'user',
          content: `Tarefa:\n${prompt}\n\nContexto:\n${context}`,
        },
      ],
    })
    const answer = completion.choices[0]?.message?.content ?? ''

    const sourceRows = (matches ?? []).map((m: { source: string; chunk_index: number; similarity: number }) => ({
      source: m.source,
      chunk_index: m.chunk_index,
      similarity: m.similarity,
    }))

    const { error: upsertErr } = await supabase
      .from('call_analysis')
      .upsert(
        {
          call_id,
          rag_enriched_summary: answer,
          rag_sources: sourceRows,
          rag_last_updated_at: new Date().toISOString(),
        },
        { onConflict: 'call_id' },
      )
    if (upsertErr) {
      await supabase.from('calls').update({ rag_enrich_status: 'failed' }).eq('id', call_id)
      return errorResponse(`failed to update call_analysis: ${upsertErr.message}`, 500)
    }
    await supabase.from('calls').update({ rag_enrich_status: 'enriched' }).eq('id', call_id)

    logStep({
      function_name: 'rag-enrich-call',
      call_id,
      step: 'enrich',
      status: 'ok',
      duration_ms: nowMs() - startedAt,
      details: { top_k: normalizedTopK, sources: sourceRows.length },
    })

    return jsonResponse({
      ok: true,
      call_id,
      answer,
      sources: sourceRows,
      matched_chunks: matches ?? [],
    })
  } catch (err) {
    logStep({
      function_name: 'rag-enrich-call',
      step: 'enrich',
      status: 'error',
      details: { message: err instanceof Error ? err.message : 'Unexpected error' },
    })
    console.error('[rag-enrich-call] error', err)
    return errorResponse(err instanceof Error ? err.message : 'Unexpected error', 500)
  }
})
