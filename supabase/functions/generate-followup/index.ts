import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase.ts'
import { callAI } from '../_shared/ai-client.ts'
import { logStep, nowMs } from '../_shared/observability.ts'

const SYSTEM_PROMPT = `Você é um assistente de vendas B2B experiente que gera follow-ups por email após uma call.
Retorne apenas JSON válido, sem markdown ou explicações adicionais.
A resposta deve ter a forma:
{
  "subject": "Assunto do email",
  "email": "Corpo do email de follow-up em português, claro e objetivo."
}
Use um tom profissional, humanizado e direto, com máximo 3 parágrafos.
Inclua contexto do prospect, próximo passo e CTA claro.`

function parseJson<T>(text: string): T | null {
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean) as T
  } catch {
    console.error('[generate-followup] JSON parse failed:', text)
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) })
  }

  try {
    const startedAt = nowMs()
    const body = await req.json()
    const call_id = body?.call_id
    if (!call_id) return errorResponse('call_id required', 400)

    const supabase = getSupabaseClient()
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select(
        'seller_name, seller_email, prospect_name, prospect_company, lead_perfil, lead_segmento, deal_id, deal_stage, deal_acv, produto_oferecido, call_date, transcript_text, status'
      )
      .eq('id', call_id)
      .single()

    if (callError || !call) {
      return errorResponse('Call not found', 404)
    }

    const { data: analysis, error: analysisError } = await supabase
      .from('call_analysis')
      .select('summary_text, next_steps, smart_trackers_detected, followup_draft')
      .eq('call_id', call_id)
      .maybeSingle()

    if (analysisError) {
      console.warn('[generate-followup] could not fetch call_analysis:', analysisError.message)
    }

    const transcript = (call.transcript_text && String(call.transcript_text).trim()) || ''

    const nextSteps = Array.isArray(analysis?.next_steps)
      ? analysis.next_steps.map((item: any) => `- ${item?.text ?? item}`).join('\n')
      : ''

    const contextParts = [
      call.prospect_name ? `Prospect: ${call.prospect_name}` : null,
      call.prospect_company ? `Empresa: ${call.prospect_company}` : null,
      call.lead_perfil ? `Perfil do lead: ${call.lead_perfil}` : null,
      call.lead_segmento ? `Segmento: ${call.lead_segmento}` : null,
      call.deal_stage ? `Etapa do funil: ${call.deal_stage}` : null,
      call.deal_acv != null ? `ACV estimado: R$ ${call.deal_acv}` : null,
      call.produto_oferecido ? `Produto ofertado: ${call.produto_oferecido}` : null,
      call.call_date ? `Data da call: ${call.call_date}` : null,
      call.status ? `Status da call: ${call.status}` : null,
    ].filter(Boolean).join(' | ')

    const existingDraft = typeof analysis?.followup_draft === 'string' ? analysis.followup_draft : null

    const prompt = `Use os dados a seguir para gerar um email de follow-up por escrito.
Contexto: ${contextParts || 'sem metadados adicionais'}
${nextSteps ? `Próximos passos conhecidos:\n${nextSteps}\n` : ''}
${existingDraft ? `Rascunho anterior (use apenas como referência, atualize se necessário):\n${existingDraft}\n` : ''}
${transcript ? `Transcrição disponível:\n${transcript}` : 'Não há transcrição disponível.'}`

    const { content } = await callAI({
      model: 'gpt-4.1-mini',
      system: SYSTEM_PROMPT,
      user: prompt,
      maxTokens: 800,
      responseFormat: 'json_object',
      userId: String(call_id),
      functionName: 'generate-followup',
    })

    const result = parseJson<{ subject?: string; email?: string }>(content || '')
    if (!result?.email) {
      console.error('[generate-followup] invalid output:', content)
      return errorResponse('AI response could not be parsed', 500)
    }

    const { error: upsertError } = await supabase.from('call_analysis').upsert({
      call_id,
      followup_draft: result.email,
    }, { onConflict: 'call_id' })
    if (upsertError) {
      console.warn('[generate-followup] failed to persist draft:', upsertError.message)
    }

    logStep({
      function_name: 'generate-followup',
      call_id,
      step: 'complete',
      status: 'ok',
      duration_ms: nowMs() - startedAt,
    })

    return jsonResponse({ ok: true, call_id, subject: result.subject ?? '', email: result.email })
  } catch (err) {
    logStep({
      function_name: 'generate-followup',
      step: 'error',
      status: 'error',
      details: { message: err instanceof Error ? err.message : 'Unknown error' },
    })
    console.error('[generate-followup] unexpected error:', err)
    return errorResponse(err instanceof Error ? err.message : 'Internal server error', 500)
  }
})