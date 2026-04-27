import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase.ts'
import { callAI } from '../_shared/ai-client.ts'
import { logStep, nowMs } from '../_shared/observability.ts'

const SYSTEM_PROMPT = `Você é um assistente de análise de calls em tempo real.
Receba apenas texto de transcrição e contexto parciais.
Retorne apenas JSON válido, sem markdown ou explicações.
A resposta deve ter exatamente esta estrutura:
{
  "analysis": {
    "transcript_chunk": "texto do trecho transcrito",
    "suggested_question": "pergunta de follow-up para o vendedor fazer",
    "active_spiced_dimension": "situation|pain|impact|critical_event|decision|delivery",
    "spiced_scores": {
      "situation": { "score": 0, "max": 5 },
      "pain": { "score": 0, "max": 5 },
      "impact": { "score": 0, "max": 5 },
      "critical_event": { "score": 0, "max": 5 },
      "decision": { "score": 0, "max": 5 },
      "delivery": { "score": 0, "max": 5 }
    },
    "signals": [],
    "red_flags": []
  }
}
Use o contexto fornecido para ajustar o dimensionamento das pontuações e a pergunta sugerida.
Por exemplo, se o trecho mostra dor do cliente, destaque "pain"; se há falta de próxima ação clara, recomende uma pergunta de "decision".
Mantenha a pergunta sugerida concreta e diretamente acionável.`

function parseJson<T>(text: string): T | null {
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean) as T
  } catch {
    console.error('[gp-analyze-live-chunk] JSON parse failed:', text)
    return null
  }
}

function normalizeTranscriptChunk(input: unknown): string {
  if (typeof input === 'string') return input.trim()
  return ''
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && UUID_RE.test(s)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) })
  }

  try {
    const startedAt = nowMs()
    const body = await req.json()
    const call_id = body?.call_id
    const transcript_chunk = normalizeTranscriptChunk(body?.transcript_chunk)
    let context = body?.context ?? null

    if (!transcript_chunk) return errorResponse('transcript_chunk is required', 400)

    const supabase = getSupabaseClient()
    if (isUuid(call_id)) {
      const { data: call, error: callError } = await supabase
        .from('calls')
        .select('prospect_name, seller_name, deal_stage, deal_acv, lead_perfil, lead_segmento, produto_oferecido')
        .eq('id', call_id)
        .single()
      if (callError) {
        console.warn('[gp-analyze-live-chunk] could not load call metadata:', callError.message)
      }
      if (call) {
        const metadata = [
          call.prospect_name ? `Prospect: ${call.prospect_name}` : null,
          call.seller_name ? `Closer: ${call.seller_name}` : null,
          call.deal_stage ? `Etapa do funil: ${call.deal_stage}` : null,
          call.deal_acv != null ? `ACV: R$ ${call.deal_acv}` : null,
          call.lead_perfil ? `Perfil: ${call.lead_perfil}` : null,
          call.lead_segmento ? `Segmento: ${call.lead_segmento}` : null,
          call.produto_oferecido ? `Produto: ${call.produto_oferecido}` : null,
        ].filter(Boolean).join(' | ')
        if (metadata) {
          context = `${metadata}\n${JSON.stringify(context ?? {})}`
        }
      }
    }

    const userPrompt = `Contexto:
${typeof context === 'string' ? context : JSON.stringify(context ?? {})}
\nTrecho de transcrição:
${transcript_chunk}`

    const { content } = await callAI({
      model: 'gpt-4.1-mini',
      system: SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 1000,
      responseFormat: 'json_object',
      userId: call_id ? String(call_id) : 'anonymous',
      functionName: 'gp-analyze-live-chunk',
    })

    const parsed = parseJson<{ analysis: unknown }>(content || '')
    if (!parsed?.analysis) {
      console.error('[gp-analyze-live-chunk] invalid AI response:', content)
      return errorResponse('AI response could not be parsed', 500)
    }

    logStep({
      function_name: 'gp-analyze-live-chunk',
      call_id: isUuid(call_id) ? call_id : undefined,
      step: 'complete',
      status: 'ok',
      duration_ms: nowMs() - startedAt,
    })

    return jsonResponse({ ok: true, call_id: call_id ?? null, analysis: parsed.analysis })
  } catch (err) {
    logStep({
      function_name: 'gp-analyze-live-chunk',
      step: 'error',
      status: 'error',
      details: { message: err instanceof Error ? err.message : 'Unknown error' },
    })
    console.error('[gp-analyze-live-chunk] unexpected error:', err)
    return errorResponse(err instanceof Error ? err.message : 'Internal server error', 500)
  }
})