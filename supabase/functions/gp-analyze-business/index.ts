import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { callAI } from "../_shared/ai-client.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const BUSINESS_SYSTEM = `Você é um analista de negócios especializado em vendas B2B high-ticket para educação executiva.
Analise a transcrição e retorne um JSON com:
{
  "deal_stage": "Descoberta|Qualificação|Proposta|Negociação|Fechamento|Perdido",
  "estimated_arr": null ou valor em reais,
  "budget_mentioned": true|false,
  "timeline_urgency": "Imediata (< 30 dias)|Curto prazo (1-3 meses)|Médio prazo (3-6 meses)|Indefinido",
  "stakeholders": [{"name": "", "role": "", "influence": "alto|médio|baixo"}],
  "pain_business_case": "síntese do caso de negócio identificado",
  "roi_signals": [{"signal": "", "evidence": ""}],
  "next_action": {
    "action": "ação específica",
    "owner": "vendedor|prospect|ambos",
    "deadline": "YYYY-MM-DD ou null",
    "channel": "WhatsApp|Email|Reunião|Ligação"
  }
}
Responda APENAS com o JSON, sem markdown.`

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } })
  }

  try {
    const { call_id, transcript } = await req.json()
    if (!call_id || !transcript) {
      return new Response(JSON.stringify({ error: "call_id and transcript required" }), { status: 400 })
    }

    // PUBLIC schema client — avoids PGRST106
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    await supabase.rpc("insert_gp_pipeline_event", { p_call_id: call_id, p_step: "analyze-business", p_status: "started" })

    const t0 = Date.now()
    const { content } = await callAI({
      model: 'gpt-4',
      system: BUSINESS_SYSTEM,
      user: `Transcrição:\n\n${transcript.slice(0, 12000)}`,
      maxTokens: 1500,
      responseFormat: 'json_object',
      userId: 'system',
      functionName: 'gp-analyze-business'
    })
    const analysis = JSON.parse(content || "{}")

    const { error } = await supabase.rpc("upsert_gp_business_analysis", {
      p_call_id:            call_id,
      p_deal_stage:         analysis.deal_stage ?? null,
      p_estimated_arr:      analysis.estimated_arr ?? null,
      p_budget_mentioned:   analysis.budget_mentioned || false,
      p_timeline_urgency:   analysis.timeline_urgency ?? null,
      p_stakeholders:       JSON.stringify(analysis.stakeholders || []),
      p_pain_business_case: analysis.pain_business_case ?? null,
      p_roi_signals:        JSON.stringify(analysis.roi_signals || []),
      p_next_action:        JSON.stringify(analysis.next_action || {}),
      p_raw_json:           JSON.stringify(analysis),
    })

    if (error) throw new Error(`DB failed: ${error.message}`)

    await supabase.rpc("insert_gp_pipeline_event", {
      p_call_id: call_id, p_step: "analyze-business", p_status: "success", p_duration_ms: Date.now() - t0
    })

    return new Response(JSON.stringify({ success: true, call_id, deal_stage: analysis.deal_stage }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
