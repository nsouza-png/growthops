import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { callAI } from "../_shared/ai-client.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const SPIN_SYSTEM = `Você é especialista em SPIN Selling para B2B high-ticket.
Analise a transcrição e retorne um JSON com:
{
  "question_map": {
    "situation": ["pergunta 1", "..."],
    "problem": ["pergunta 1", "..."],
    "implication": ["pergunta 1", "..."],
    "need_payoff": ["pergunta 1", "..."]
  },
  "sequence_analysis": "análise da sequência de perguntas",
  "scores": {
    "situation": 0-10,
    "problem": 0-10,
    "implication": 0-10,
    "need_payoff": 0-10,
    "total": 0-40
  },
  "top_missed_questions": ["pergunta que deveria ter sido feita"],
  "coaching_priority": "dimensão mais crítica para desenvolver"
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
    await supabase.rpc("insert_gp_pipeline_event", { p_call_id: call_id, p_step: "score-spin", p_status: "started" })

    const t0 = Date.now()
    const { content } = await callAI({
      model: 'gpt-4.1-mini',
      system: SPIN_SYSTEM,
      user: `Transcrição:\n\n${transcript.slice(0, 12000)}`,
      maxTokens: 1500,
      responseFormat: 'json_object',
      userId: 'system',
      functionName: 'gp-score-spin'
    })
    const spin = JSON.parse(content || "{}")
    const qmap = spin.question_map || {}
    const scores = spin.scores || {}

    const { error } = await supabase.rpc("upsert_gp_framework_scores", {
      p_call_id: call_id,
      p_scores: {
        spin_situation_count:   (qmap.situation || []).length,
        spin_problem_count:     (qmap.problem || []).length,
        spin_implication_count: (qmap.implication || []).length,
        spin_need_payoff_count: (qmap.need_payoff || []).length,
        spin_sequence_analysis: spin.sequence_analysis,
        spin_total_score:       scores.total,
        spin_missed_questions:  spin.top_missed_questions || [],
        spin_coaching_priority: spin.coaching_priority,
      }
    })

    if (error) throw new Error(`DB failed: ${error.message}`)

    await supabase.rpc("insert_gp_pipeline_event", {
      p_call_id: call_id, p_step: "score-spin", p_status: "success", p_duration_ms: Date.now() - t0
    })

    return new Response(JSON.stringify({ success: true, call_id, spin_total: scores.total }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
