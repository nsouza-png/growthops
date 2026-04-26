import { corsHeaders, errorResponse, getSupabaseClient, jsonResponse } from '../_shared/supabase.ts'
import OpenAI from 'https://esm.sh/openai@4.71.1'

function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }

  try {
    const { query, topK = 8, source = null } = await req.json()
    if (!query || typeof query !== 'string') {
      return errorResponse('query is required', 400)
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return errorResponse('OPENAI_API_KEY not configured', 500)
    }

    const openai = new OpenAI({ apiKey })
    const supabase = getSupabaseClient()

    const embeddingResp = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })
    const queryEmbedding = embeddingResp.data[0]?.embedding
    if (!queryEmbedding) {
      return errorResponse('failed to generate query embedding', 500)
    }

    const { data: matches, error: matchError } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: toPgVector(queryEmbedding),
      match_count: topK,
      source_filter: source,
    })
    if (matchError) {
      return errorResponse(`match_knowledge_chunks failed: ${matchError.message}`, 500)
    }

    const context = (matches ?? [])
      .map((m: any, idx: number) => `[#${idx + 1}] (${m.source})\n${m.content}`)
      .join('\n\n---\n\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content:
            'Você é um assistente de produto. Responda apenas com base no contexto recuperado. Se faltar evidência, diga explicitamente que não encontrou no corpus.',
        },
        {
          role: 'user',
          content: `Pergunta:\n${query}\n\nContexto recuperado:\n${context}`,
        },
      ],
    })

    const answer = completion.choices[0]?.message?.content ?? ''

    return jsonResponse({
      query,
      answer,
      sources: (matches ?? []).map((m: any) => ({
        source: m.source,
        chunk_index: m.chunk_index,
        similarity: m.similarity,
      })),
      matched_chunks: matches ?? [],
    })
  } catch (err) {
    console.error('[rag-query] error', err)
    return errorResponse(err instanceof Error ? err.message : 'Unexpected error', 500)
  }
})
