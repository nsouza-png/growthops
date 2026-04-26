import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { callAI } from "../_shared/ai-client.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const PDI_SYSTEM = `Você é um coach de vendas especializado em desenvolvimento de closers B2B high-ticket.
Crie um PDI (Plano de Desenvolvimento Individual) baseado nos dados de performance da call.
Retorne um JSON com:
{
  "summary": "diagnóstico em 2 frases",
  "priorities": [
    {
      "area": "área de desenvolvimento",
      "current_level": "descrição do nível atual",
      "target_level": "onde precisa chegar",
      "exercises": ["exercício prático 1", "exercício prático 2"],
      "timeline_weeks": 4
    }
  ],
  "quick_wins": ["ação imediata para próxima call"],
  "kpi_targets": {
    "talk_ratio_target": 40,
    "spiced_target_pct": 70,
    "unified_behavior_target": 75
  },
  "coaching_cadence": "semanal|quinzenal|mensal"
}
Máximo 3 prioridades. Seja específico e prático.
Responda APENAS com o JSON, sem markdown.`

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } })
  }

  try {
    // Validar JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } })
    }

    const authClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } })
    }

    const { call_id, period } = await req.json()
    if (!call_id) return new Response(JSON.stringify({ error: "call_id required" }), { status: 400 })

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      db: { schema: 'GrowthPlatform' },
    })

    const { data: call, error: callErr } = await supabase
      .from("calls")
      .select("seller_email, seller_name, framework_scores, behavior_signals")
      .eq("id", call_id)
      .single()

    if (callErr || !call) throw new Error(`Call not found: ${callErr?.message}`)

    const fs = call.framework_scores as Record<string, unknown> | null
    const bs = call.behavior_signals as Record<string, unknown> | null

    const context = `
Vendedor: ${call.seller_name} (${call.seller_email})
SPICED: ${fs?.spiced_pct}% | Dimensão mais fraca: ${fs?.spiced_weak_dimension}
Challenger: ${fs?.challenger_total}/30 | ${fs?.challenger_classification}
SPIN total: ${fs?.spin_total_score}/40 | Prioridade coaching: ${fs?.spin_coaching_priority}
Talk ratio vendedor: ${bs?.talk_ratio_seller_pct}%
Peeling depth: ${bs?.peeling_depth_levels} níveis
Perfil comportamental: ${bs?.seller_profile}
Score unificado: ${bs?.unified_score}/${bs?.unified_score_max} (${bs?.unified_score_band})
Top gap: ${fs?.top_gap}
Priority coaching: ${fs?.priority_coaching}
`

    const { content } = await callAI({
      model: 'gpt-4',
      system: PDI_SYSTEM,
      user: `Dados de performance:\n${context}`,
      maxTokens: 2000,
      responseFormat: 'json_object',
      userId: user.id,
      functionName: 'gp-generate-pdi'
    })
    const pdi = JSON.parse(content || "{}")

    // Write via SECURITY DEFINER RPC (migration 010) — no schema switching needed
    const { error: rpcErr } = await supabase.rpc("insert_gp_closer_pdi", {
      p_call_id:      call_id,
      p_seller_email: call.seller_email,
      p_pdi_content:  pdi,
      p_period:       period ?? null,
      p_generated_by: "gpt-4",
    })
    if (rpcErr) throw new Error(`DB failed: ${rpcErr.message}`)

    return new Response(JSON.stringify({ success: true, call_id, pdi }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
