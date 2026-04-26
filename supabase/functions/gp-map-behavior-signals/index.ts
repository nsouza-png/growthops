import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { callAI } from "../_shared/ai-client.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const BEHAVIOR_SYSTEM = `Você analisa sinais comportamentais em calls de vendas B2B.
Analise a transcrição e retorne um JSON com:
{
  "talk_ratio_seller_pct": 0-100,
  "peeling_depth_levels": 0-5,
  "transitions_detected": 0-20,
  "name_usage_count": 0-50,
  "seller_profile": "Consultivo|Apresentador|Interrogador|Passivo",
  "top_signals": [
    {"signal": "nome do sinal", "evidence": "trecho da call", "impact": "positivo|negativo|neutro"}
  ],
  "unified_score": {
    "score": 0-100,
    "max": 100,
    "band": "Elite|Avançado|Intermediário|Iniciante"
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
    await supabase.rpc("insert_gp_pipeline_event", { p_call_id: call_id, p_step: "map-behavior-signals", p_status: "started" })

    const t0 = Date.now()
    const { content } = await callAI({
      model: 'gpt-4.1-mini',
      system: BEHAVIOR_SYSTEM,
      user: `Transcrição:\n\n${transcript.slice(0, 12000)}`,
      maxTokens: 1200,
      responseFormat: 'json_object',
      userId: 'system',
      functionName: 'gp-map-behavior-signals'
    })
    const behavior = JSON.parse(content || "{}")
    const unified = behavior.unified_score || {}

    const { error } = await supabase.rpc("upsert_gp_behavior_signals", {
      p_call_id:               call_id,
      p_talk_ratio_seller_pct: behavior.talk_ratio_seller_pct ?? null,
      p_peeling_depth_levels:  behavior.peeling_depth_levels ?? null,
      p_transitions_detected:  behavior.transitions_detected ?? null,
      p_name_usage_count:      behavior.name_usage_count ?? null,
      p_seller_profile:        behavior.seller_profile ?? null,
      p_top_signals:           behavior.top_signals ?? [],
      p_unified_score:         unified.score ?? null,
      p_unified_score_max:     unified.max ?? null,
      p_unified_score_band:    unified.band ?? null,
    })

    if (error) throw new Error(`DB failed: ${error.message}`)

    await supabase.rpc("insert_gp_pipeline_event", {
      p_call_id: call_id, p_step: "map-behavior-signals", p_status: "success", p_duration_ms: Date.now() - t0
    })

    return new Response(JSON.stringify({ success: true, call_id, unified_score: unified.score }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
