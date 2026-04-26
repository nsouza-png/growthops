import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { callAI } from "../_shared/ai-client.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const CHALLENGER_SYSTEM = `Você é especialista no framework Challenger Sale para B2B high-ticket.
Analise a transcrição e retorne um JSON com:
{
  "scores": {
    "teach": {"score": 0-10, "evidence": "", "gaps": []},
    "tailor": {"score": 0-10, "evidence": "", "gaps": []},
    "take_control": {"score": 0-10, "evidence": "", "gaps": []}
  },
  "score_total": 0-30,
  "classification": "Challenger Elite|Challenger|Em Desenvolvimento|Reativo",
  "red_flags": [],
  "coaching_recommendation": "",
  "key_moments": []
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
    await supabase.rpc("insert_gp_pipeline_event", { p_call_id: call_id, p_step: "score-challenger", p_status: "started" })

    const t0 = Date.now()
    const { content } = await callAI({
      model: 'gpt-4.1-mini',
      system: CHALLENGER_SYSTEM,
      user: `Transcrição:\n\n${transcript.slice(0, 12000)}`,
      maxTokens: 1500,
      responseFormat: 'json_object',
      userId: 'system',
      functionName: 'gp-score-challenger'
    })
    const challenger = JSON.parse(content || "{}")
    const scores = challenger.scores || {}

    const { error } = await supabase.rpc("upsert_gp_framework_scores", {
      p_call_id: call_id,
      p_scores: {
        challenger_teach_score:   scores.teach?.score ?? null,
        challenger_tailor_score:  scores.tailor?.score ?? null,
        challenger_control_score: scores.take_control?.score ?? null,
        challenger_total:         challenger.score_total ?? null,
        challenger_classification: challenger.classification ?? null,
        challenger_red_flags:     challenger.red_flags ?? [],
        challenger_coaching_rec:  challenger.coaching_recommendation ?? null,
      }
    })

    if (error) throw new Error(`DB failed: ${error.message}`)

    await supabase.rpc("insert_gp_pipeline_event", {
      p_call_id: call_id, p_step: "score-challenger", p_status: "success", p_duration_ms: Date.now() - t0
    })

    return new Response(JSON.stringify({ success: true, call_id, challenger_total: challenger.score_total }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
