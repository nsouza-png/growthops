import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { callAI } from "../_shared/ai-client.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const SPICED_SYSTEM = `Você é um especialista em metodologia SPICED para vendas B2B high-ticket.
Analise a transcrição e retorne um JSON com:
{
  "scores": {
    "situation": {"score": 0-10, "justification": "", "key_excerpt": "", "gaps": []},
    "pain": {"score": 0-10, "justification": "", "key_excerpt": "", "gaps": []},
    "impact": {"score": 0-10, "justification": "", "key_excerpt": "", "gaps": []},
    "critical_event": {"score": 0-10, "justification": "", "key_excerpt": "", "gaps": []},
    "decision": {"score": 0-10, "justification": "", "key_excerpt": "", "gaps": []},
    "delivery": {"score": 0-10, "justification": "", "key_excerpt": "", "gaps": []}
  },
  "score_total": 0-60,
  "score_percentual": 0-100,
  "classification": "Excelente|Bom|Regular|Fraco",
  "weak_dimension": "",
  "red_flags": [],
  "call_highlights": [],
  "coaching_recommendation": "",
  "deal_next_steps": ""
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
    await supabase.rpc("insert_gp_pipeline_event", { p_call_id: call_id, p_step: "score-spiced", p_status: "started" })

    const t0 = Date.now()

    const { content } = await callAI({
      model: 'gpt-4.1-mini',
      system: SPICED_SYSTEM,
      user: `Transcrição:\n\n${transcript.slice(0, 12000)}`,
      maxTokens: 2000,
      responseFormat: 'json_object',
      userId: 'system',
      functionName: 'gp-score-spiced'
    })

    const spiced = JSON.parse(content || "{}")
    const scores = spiced.scores || {}

    const upsertData = {
      call_id,
      spiced_situation_score: scores.situation?.score,
      spiced_pain_score: scores.pain?.score,
      spiced_impact_score: scores.impact?.score,
      spiced_critical_event_score: scores.critical_event?.score,
      spiced_decision_score: scores.decision?.score,
      spiced_delivery_score: scores.delivery?.score,
      spiced_total: spiced.score_total,
      spiced_pct: spiced.score_percentual,
      spiced_classification: spiced.classification,
      spiced_weak_dimension: spiced.weak_dimension,
      spiced_red_flags: spiced.red_flags || [],
      spiced_highlights: spiced.call_highlights || [],
      spiced_coaching_rec: spiced.coaching_recommendation,
      spiced_next_steps: spiced.deal_next_steps,
      raw_json: spiced
    }

    const { error } = await supabase.rpc("upsert_gp_framework_scores", {
      p_call_id: call_id,
      p_scores: upsertData
    })
    if (error) throw new Error(`DB upsert failed: ${error.message}`)

    await supabase.rpc("insert_gp_pipeline_event", {
      p_call_id: call_id, p_step: "score-spiced", p_status: "success", p_duration_ms: Date.now() - t0
    })

    return new Response(JSON.stringify({ success: true, call_id, spiced_pct: spiced.score_percentual }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
