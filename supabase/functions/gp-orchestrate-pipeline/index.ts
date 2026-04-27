/**
 * gp-orchestrate-pipeline
 * 
 * Master orchestrator for AI-powered call enrichment pipeline.
 * Coordinates execution of all derived table population in sequence:
 * 1. call_analysis (transcript + AI summary)
 * 2. behavior_signals (AI detection of patterns)
 * 3. framework_scores (SPICED, SPIN, CHALLENGER scoring)
 * 4. business_analysis (AI business impact analysis)
 * 5. smart_alerts (AI-based alert generation)
 * 6. call_followups (AI-generated follow-up suggestions)
 * 7. closer_pdis (AI-generated PDI from call performance)
 * 8. snippets extraction (AI-identified key moments)
 * 
 * Triggers on: call with transcript_text available
 * Parallelizes: independent analyses (behavior, business, alerts)
 * Sequences: PDI and followups (depend on analysis results)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getSupabaseClient, corsHeaders, jsonResponse, errorResponse } from "../_shared/supabase.ts"
import { logStep, nowMs } from "../_shared/observability.ts"
import { callAI } from "../_shared/ai-client.ts"

interface PipelineInput {
  call_id: string
  user_id: string
  parallel_mode?: boolean // if true, run all analyses in parallel
}

interface AnalysisResults {
  call_analysis?: any
  behavior_signals?: any
  framework_scores?: { spiced: any; spin: any; challenger: any }
  business_analysis?: any
  smart_alerts?: any
  call_followups?: any
  closer_pdi?: any
}

async function getCallData(supabase: any, callId: string) {
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("id", callId)
    .single()

  if (error || !data) throw new Error(`Call not found: ${callId}`)
  if (!data.transcript_text) throw new Error(`Call ${callId} has no transcript`)

  return data
}

/**
 * Stage 1: Core call_analysis
 * Extracts: summary, pains, objections, competitors, buy signals, churn signals
 */
async function analyzeCall(
  supabase: any,
  call: any,
  userId: string
): Promise<any> {
  const systemPrompt = `Você é um analisador de sales calls especializado em B2B.
Analise a transcrição e extraia:
1. Resumo executivo (2 frases)
2. Dores do cliente identificadas
3. Objeções levantadas
4. Competidores mencionados
5. Sinais de intenção de compra
6. Sinais de churn/risco
7. Momentos críticos
8. Próximas ações sugeridas
9. Talk ratio (% vendedor vs cliente, aproximado)
10. Duração do maior monólogo do vendedor em segundos

Responda APENAS em JSON com essa estrutura:
{
  "summary_text": "...",
  "client_pains": ["pain1", "pain2"],
  "objections": ["obj1", "obj2"],
  "competitors": ["comp1", "comp2"],
  "buy_intent_signals": ["signal1"],
  "churn_signals": ["signal1"],
  "critical_moments": [{"timestamp": "mm:ss", "description": "..."}],
  "next_steps": ["step1", "step2"],
  "talk_ratio_seller": 65,
  "longest_monologue_s": 180
}`

  const result = await callAI({
    model: "gpt-4o",
    system: systemPrompt,
    user: `Transcrição da call:\n${call.transcript_text}`,
    maxTokens: 2000,
    responseFormat: "json_object",
    userId,
    functionName: "gp-orchestrate-pipeline",
  })

  const parsed = JSON.parse(result.content)

  const { error: insertError } = await supabase
    .from("call_analysis")
    .upsert(
      {
        call_id: call.id,
        summary_text: parsed.summary_text,
        client_pains: parsed.client_pains,
        objections: parsed.objections,
        competitors: parsed.competitors,
        buy_intent_signals: parsed.buy_intent_signals,
        churn_signals: parsed.churn_signals,
        critical_moments: parsed.critical_moments,
        next_steps: parsed.next_steps,
        talk_ratio_seller: parsed.talk_ratio_seller,
        longest_monologue_s: parsed.longest_monologue_s,
        model_version: "gpt-4o",
        analysis_version: 1,
      },
      { onConflict: "call_id" }
    )

  if (insertError) throw new Error(`Failed to save call_analysis: ${insertError.message}`)

  return parsed
}

/**
 * Stage 2: Behavior signals detection
 * Parallel operation: detects sales framework usage patterns
 */
async function extractBehaviorSignals(
  supabase: any,
  call: any,
  userId: string
): Promise<any> {
  const systemPrompt = `Analise a transcrição de vendas e identifique:
1. Uso de METODOLOGIA DE VENDAS (SPIN, SPICED, Challenger, etc.)
2. Técnicas de NEGOCIAÇÃO (anchoring, takeaway, assumptive close)
3. GATILHOS EMOCIONAIS usados (urgência, escassez, social proof)
4. PADRÕES DE COMUNICAÇÃO (empatia, reframing, objection handling)
5. SINAIS DE DESENGAJAMENTO do cliente
6. SINAIS DE ENGAJAMENTO do cliente

Responda em JSON:
{
  "methodology_detected": ["SPIN", "SPICED"],
  "negotiation_tactics": ["anchoring"],
  "emotional_triggers": ["urgency"],
  "communication_patterns": [{"pattern": "empatia", "count": 3}],
  "disengagement_signals": [],
  "engagement_signals": ["laughter", "follow_up_questions"],
  "overall_approach": "consultativo|transacional|agressivo"
}`

  const result = await callAI({
    model: "gpt-4o",
    system: systemPrompt,
    user: `Transcrição:\n${call.transcript_text.substring(0, 4000)}`,
    maxTokens: 1500,
    responseFormat: "json_object",
    userId,
    functionName: "gp-orchestrate-pipeline",
  })

  const parsed = JSON.parse(result.content)

  const { error: insertError } = await supabase
    .from("behavior_signals")
    .upsert(
      {
        call_id: call.id,
        signals_detected: parsed,
        signal_strength: 0.8,
        flagged_for_review: false,
      },
      { onConflict: "call_id" }
    )

  if (insertError) throw new Error(`Failed to save behavior_signals: ${insertError.message}`)

  return parsed
}

/**
 * Stage 3: Multi-framework scoring
 * Parallel operation: scores the call against SPICED, SPIN, CHALLENGER
 */
async function scoreFrameworks(
  supabase: any,
  call: any,
  userId: string
): Promise<any> {
  const systemPrompt = `Score a sales call against three frameworks. Return JSON:
{
  "spiced": {
    "situation": 0-100,
    "pain": 0-100,
    "impact": 0-100,
    "critical_event": 0-100,
    "decision": 0-100,
    "total": 0-100,
    "reasoning": "..."
  },
  "spin": {
    "situation_questions": 0-100,
    "problem_questions": 0-100,
    "implication_questions": 0-100,
    "need_payoff_questions": 0-100,
    "total": 0-100,
    "reasoning": "..."
  },
  "challenger": {
    "insight_quality": 0-100,
    "command_capability": 0-100,
    "control_ability": 0-100,
    "total": 0-100,
    "reasoning": "..."
  }
}`

  const result = await callAI({
    model: "gpt-4o",
    system: systemPrompt,
    user: `Transcrição:\n${call.transcript_text.substring(0, 4000)}`,
    maxTokens: 2000,
    responseFormat: "json_object",
    userId,
    functionName: "gp-orchestrate-pipeline",
  })

  const parsed = JSON.parse(result.content)

  const { error: insertError } = await supabase
    .from("framework_scores")
    .upsert(
      {
        call_id: call.id,
        spiced_situation: parsed.spiced.situation,
        spiced_pain: parsed.spiced.pain,
        spiced_impact: parsed.spiced.impact,
        spiced_critical_event: parsed.spiced.critical_event,
        spiced_decision: parsed.spiced.decision,
        spiced_total: parsed.spiced.total,
        spin_situation: parsed.spin.situation_questions,
        spin_problem: parsed.spin.problem_questions,
        spin_implication: parsed.spin.implication_questions,
        spin_payoff: parsed.spin.need_payoff_questions,
        spin_total: parsed.spin.total,
        challenger_insight: parsed.challenger.insight_quality,
        challenger_command: parsed.challenger.command_capability,
        challenger_control: parsed.challenger.control_ability,
        challenger_total: parsed.challenger.total,
      },
      { onConflict: "call_id" }
    )

  if (insertError) throw new Error(`Failed to save framework_scores: ${insertError.message}`)

  return parsed
}

/**
 * Stage 4: Business analysis
 * Parallel operation: analyzes business impact and deal progression
 */
async function analyzeBusinessImpact(
  supabase: any,
  call: any,
  userId: string
): Promise<any> {
  const systemPrompt = `Analise o impacto de negócio da call:
{
  "deal_advancement": "avançou|estagnado|retrocedeu",
  "advancement_reason": "...",
  "roi_potential": 0-100,
  "implementation_complexity": "baixa|média|alta",
  "budget_alignment": "alinhado|diverge",
  "timeline_fit": "urgente|normal|flexível",
  "competitive_position": "favorável|neutro|desfavorável",
  "decision_making_maturity": 1-5,
  "recommended_next_action": "...",
  "risk_factors": ["..."],
  "opportunities": ["..."]
}`

  const result = await callAI({
    model: "gpt-4o",
    system: systemPrompt,
    user: `Call info:\n${JSON.stringify({ prospect: call.prospect_name, company: call.prospect_company, stage: call.deal_stage })}\n\nTranscrição:\n${call.transcript_text.substring(0, 3000)}`,
    maxTokens: 1500,
    responseFormat: "json_object",
    userId,
    functionName: "gp-orchestrate-pipeline",
  })

  const parsed = JSON.parse(result.content)

  const { error: insertError } = await supabase
    .from("business_analysis")
    .upsert(
      {
        call_id: call.id,
        analysis_data: parsed,
        deal_advancement: parsed.deal_advancement,
        roi_potential: parsed.roi_potential,
        risk_factors: parsed.risk_factors,
      },
      { onConflict: "call_id" }
    )

  if (insertError) throw new Error(`Failed to save business_analysis: ${insertError.message}`)

  return parsed
}

/**
 * Stage 5: Smart alerts generation
 * Parallel operation: creates actionable alerts for the sales team
 */
async function generateSmartAlerts(
  supabase: any,
  call: any,
  analysisResults: any,
  userId: string
): Promise<any> {
  const systemPrompt = `Gere alertas inteligentes baseado na análise. Cada alerta tem prioridade:
[
  {
    "type": "churn_risk|budget_constraint|competitive_pressure|delay_signal|opportunity",
    "priority": "critical|high|medium",
    "message": "Mensagem acionável",
    "suggested_action": "Ação específica",
    "due_date_days": 1-7
  }
]`

  const result = await callAI({
    model: "gpt-4o",
    system: systemPrompt,
    user: `Analysis data:\n${JSON.stringify(analysisResults.call_analysis)}\n\nBusiness: ${JSON.stringify(analysisResults.business_analysis)}`,
    maxTokens: 1000,
    responseFormat: "json_object",
    userId,
    functionName: "gp-orchestrate-pipeline",
  })

  const alerts = JSON.parse(result.content)

  for (const alert of alerts) {
    const { error: insertError } = await supabase
      .from("smart_alerts")
      .insert({
        call_id: call.id,
        alert_type: alert.type,
        priority: alert.priority,
        message: alert.message,
        suggested_action: alert.suggested_action,
        due_date: new Date(Date.now() + alert.due_date_days * 86400000).toISOString(),
      })

    if (insertError) console.error(`Failed to save alert: ${insertError.message}`)
  }

  return alerts
}

/**
 * Stage 6: Follow-up generation
 * Depends on: call_analysis
 */
async function generateFollowups(
  supabase: any,
  call: any,
  analysisResults: any,
  userId: string
): Promise<any> {
  const systemPrompt = `Gere 2-3 sugestões de follow-up personalizadas baseado na call:
[
  {
    "type": "email|call|demo|document",
    "subject": "...",
    "content_template": "...",
    "timing_hours": 24-72,
    "owner": "vendedor|manager|cs"
  }
]`

  const result = await callAI({
    model: "gpt-4o",
    system: systemPrompt,
    user: `Next steps from analysis:\n${JSON.stringify(analysisResults.call_analysis.next_steps)}\n\nProspect: ${call.prospect_name}`,
    maxTokens: 1500,
    responseFormat: "json_object",
    userId,
    functionName: "gp-orchestrate-pipeline",
  })

  const followups = JSON.parse(result.content)

  for (const followup of followups) {
    const { error: insertError } = await supabase
      .from("call_followups")
      .insert({
        call_id: call.id,
        followup_type: followup.type,
        subject: followup.subject,
        content_draft: followup.content_template,
        suggested_timing_hours: followup.timing_hours,
        owner_role: followup.owner,
        status: "suggested",
      })

    if (insertError) console.error(`Failed to save followup: ${insertError.message}`)
  }

  return followups
}

/**
 * Stage 7: Closer PDI generation
 * Depends on: call_analysis + framework_scores + behavior_signals
 */
async function generateCloserPDI(
  supabase: any,
  call: any,
  analysisResults: any,
  userId: string
): Promise<any> {
  const systemPrompt = `Gere um PDI específico para o closer baseado no desempenho da call:
{
  "title": "PDI para [Data]",
  "overall_performance": 1-10,
  "strengths": ["..."],
  "improvement_areas": [
    {
      "area": "Qualidade de perguntas",
      "current_level": "descrição",
      "target": "descrição",
      "exercises": ["exercício 1", "exercício 2"],
      "priority": "alta|média|baixa"
    }
  ],
  "quick_wins": ["..."],
  "framework_focus": "SPICED|SPIN|Challenger",
  "coaching_cadence": "semanal|quinzenal"
}`

  const result = await callAI({
    model: "gpt-4o",
    system: systemPrompt,
    user: `Performance data:\n${JSON.stringify({
      scores: analysisResults.framework_scores,
      behaviors: analysisResults.behavior_signals,
      analysis: analysisResults.call_analysis,
    })}`,
    maxTokens: 2000,
    responseFormat: "json_object",
    userId,
    functionName: "gp-orchestrate-pipeline",
  })

  const pdi = JSON.parse(result.content)

  const { error: insertError } = await supabase
    .from("closer_pdis")
    .insert({
      call_id: call.id,
      seller_email: call.seller_email,
      pdi_data: pdi,
      overall_performance: pdi.overall_performance,
      focus_framework: pdi.framework_focus,
      assigned_on: new Date().toISOString(),
      due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: "draft",
    })

  if (insertError) throw new Error(`Failed to save closer_pdi: ${insertError.message}`)

  return pdi
}

async function runPipeline(input: PipelineInput): Promise<AnalysisResults> {
  const supabase = getSupabaseClient()
  const startTime = nowMs()

  try {
    const call = await getCallData(supabase, input.call_id)
    logStep({
      function_name: "gp-orchestrate-pipeline",
      call_id: input.call_id,
      step: "pipeline_start",
      status: "running",
    })

    // Stage 1: Core analysis (SEQUENTIAL - foundation for others)
    const callAnalysis = await analyzeCall(supabase, call, input.user_id)
    logStep({
      function_name: "gp-orchestrate-pipeline",
      call_id: input.call_id,
      step: "call_analysis",
      status: "complete",
      duration_ms: nowMs() - startTime,
    })

    // Stages 2-5: Parallel analyses (no dependencies)
    const [behaviorSignals, frameworks, businessAnalysis] = input.parallel_mode
      ? await Promise.all([
          extractBehaviorSignals(supabase, call, input.user_id),
          scoreFrameworks(supabase, call, input.user_id),
          analyzeBusinessImpact(supabase, call, input.user_id),
        ])
      : [
          await extractBehaviorSignals(supabase, call, input.user_id),
          await scoreFrameworks(supabase, call, input.user_id),
          await analyzeBusinessImpact(supabase, call, input.user_id),
        ]

    const analysisResults: AnalysisResults = {
      call_analysis: callAnalysis,
      behavior_signals: behaviorSignals,
      framework_scores: frameworks,
      business_analysis: businessAnalysis,
    }

    logStep({
      function_name: "gp-orchestrate-pipeline",
      call_id: input.call_id,
      step: "parallel_analyses",
      status: "complete",
      duration_ms: nowMs() - startTime,
    })

    // Stage 5: Smart alerts (depends on analyses)
    const alerts = await generateSmartAlerts(
      supabase,
      call,
      analysisResults,
      input.user_id
    )
    analysisResults.smart_alerts = alerts

    // Stage 6: Followups (depends on call_analysis)
    const followups = await generateFollowups(
      supabase,
      call,
      analysisResults,
      input.user_id
    )
    analysisResults.call_followups = followups

    // Stage 7: PDI (depends on multiple results)
    const pdi = await generateCloserPDI(supabase, call, analysisResults, input.user_id)
    analysisResults.closer_pdi = pdi

    // Mark call as fully processed
    await supabase
      .from("calls")
      .update({
        processing_status: "completed",
        processing_stage: "all_derived_tables_populated",
        processed_at: new Date().toISOString(),
      })
      .eq("id", input.call_id)

    logStep({
      function_name: "gp-orchestrate-pipeline",
      call_id: input.call_id,
      step: "pipeline_complete",
      status: "success",
      duration_ms: nowMs() - startTime,
    })

    return analysisResults
  } catch (error) {
    console.error("[gp-orchestrate-pipeline] Error:", error.message)

    await supabase
      .from("calls")
      .update({
        processing_status: "pipeline_failed",
        processing_stage: "error",
      })
      .eq("id", input.call_id)

    throw error
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() })
  }

  try {
    const { call_id, user_id, parallel_mode } = (await req.json()) as PipelineInput

    if (!call_id || !user_id) {
      return errorResponse("Missing call_id or user_id", 400)
    }

    const results = await runPipeline({ call_id, user_id, parallel_mode: true })
    return jsonResponse({
      ok: true,
      call_id,
      pipeline_duration_ms: nowMs(),
      results_summary: {
        call_analysis: results.call_analysis ? "✓" : "✗",
        behavior_signals: results.behavior_signals ? "✓" : "✗",
        framework_scores: results.framework_scores ? "✓" : "✗",
        business_analysis: results.business_analysis ? "✓" : "✗",
        smart_alerts: results.smart_alerts ? `✓ (${results.smart_alerts.length})` : "✗",
        call_followups: results.call_followups ? `✓ (${results.call_followups.length})` : "✗",
        closer_pdi: results.closer_pdi ? "✓" : "✗",
      },
    })
  } catch (error) {
    console.error("[gp-orchestrate-pipeline] Request error:", error)
    return errorResponse(error.message, 500)
  }
})
