import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { callAI } from "../_shared/ai-client.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const WHATSAPP_SYSTEM = `Você gera mensagens de follow-up para WhatsApp após calls de vendas B2B.
Estilo: direto, humano, sem emojis excessivos, máximo 3 parágrafos curtos.
Inclua: reconhecimento do contexto da call, próximo passo claro, call-to-action específico.
Retorne um JSON com:
{
  "message": "texto da mensagem WhatsApp",
  "tone": "formal|casual|consultivo",
  "cta": "ação esperada do prospect"
}
Responda APENAS com o JSON, sem markdown.`

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } })
  }

  try {
    const { call_id } = await req.json()
    if (!call_id) return new Response(JSON.stringify({ error: "call_id required" }), { status: 400 })

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      db: { schema: 'GrowthPlatform' },
    })

    const { data: call, error: callErr } = await supabase
      .from("calls")
      .select("seller_name, seller_email, prospect_name, prospect_company, call_date, business_analysis, framework_scores")
      .eq("id", call_id)
      .single()

    if (callErr || !call) throw new Error(`Call not found: ${callErr?.message}`)

    // Extract nested JSON columns (aggregated by gp_calls view)
    const biz = call.business_analysis as Record<string, unknown> | null
    const fs = call.framework_scores as Record<string, unknown> | null

    const context = `
Vendedor: ${call.seller_name}
Prospect: ${call.prospect_name} (${call.prospect_company || 'empresa não identificada'})
Data da call: ${call.call_date}
Deal stage: ${biz?.deal_stage || 'desconhecido'}
Próximo passo SPICED: ${fs?.spiced_next_steps || 'não definido'}
Próxima ação: ${JSON.stringify(biz?.next_action || {})}
Urgência: ${biz?.timeline_urgency || 'indefinida'}
`

    const { content } = await callAI({
      model: 'gpt-4',
      system: WHATSAPP_SYSTEM,
      user: `Contexto da call:\n${context}`,
      maxTokens: 600,
      responseFormat: 'json_object',
      userId: 'system',
      functionName: 'gp-generate-whatsapp'
    })
    const result = JSON.parse(content || "{}")

    // Write via SECURITY DEFINER RPC (migration 010) — no schema switching needed
    const { error: rpcErr } = await supabase.rpc("insert_gp_call_followup", {
      p_call_id: call_id,
      p_channel: "whatsapp",
      p_content: result.message ?? "",
      p_generated_by: "gpt-4",
    })
    if (rpcErr) throw new Error(`DB failed: ${rpcErr.message}`)

    return new Response(JSON.stringify({ success: true, call_id, ...result }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
