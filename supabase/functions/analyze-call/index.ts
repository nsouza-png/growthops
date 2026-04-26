/**
 * analyze-call
 * Sends the call transcript to ChatGPT (OpenAI) and writes:
 *   - call_analysis: summary, pains, next_steps, signals, talk ratio
 *   - methodology_scores: SPICED / SPIN / Challenger scores (0-10 each)
 */

import { getSupabaseClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase.ts'
import { logStep, nowMs } from '../_shared/observability.ts'

const OPENAI_MODEL = 'gpt-4'

// ─── System prompts ───────────────────────────────────────────────────────────

const BRIEFER_SYSTEM = `Você é um especialista em análise de calls de vendas B2B.
Analise a transcrição fornecida e retorne um JSON com a seguinte estrutura EXATA (sem markdown, apenas JSON puro):
{
  "summary_text": "Resumo executivo da call em 2-3 frases",
  "client_pains": [{"text": "dor ou problema mencionado", "timestamp_s": 0}],
  "next_steps": [{"text": "próximo passo acordado"}],
  "critical_moments": [{"text": "momento crítico da call", "timestamp_s": 0, "type": "buy_signal|objection|pain|decision"}],
  "competitors": [{"name": "nome do concorrente", "timestamp_s": 0, "quote": "trecho relevante"}],
  "objections": [{"text": "objeção levantada pelo cliente", "timestamp_s": 0}],
  "churn_signals": [{"text": "sinal de risco", "timestamp_s": 0}],
  "buy_intent_signals": [{"text": "sinal de intenção de compra", "timestamp_s": 0}],
  "next_action": {
    "action": "string — ação concreta recomendada para o closer (ex: Agendar demo técnica)",
    "timing": "string — quando executar (ex: Dentro de 48h, Antes do próximo contato)",
    "main_argument": "string — argumento principal a usar (ex: Validar ROI com equipe técnica)"
  }
}
Seja preciso e baseado apenas no que foi dito na transcrição.
O campo next_action deve ser prescritivo e específico para o momento atual do deal.
Se não houver evidência suficiente para recomendar, usar action: "Aguardar resposta do prospect".`

const METHODOLOGY_SYSTEM = `Você é um especialista sênior em metodologias de vendas B2B (SPICED, SPIN, Challenger Sale).
Analise a transcrição e avalie o desempenho do closer em cada dimensão de 0 a 10.
REGRA FUNDAMENTAL: Se não houver evidência EXPLÍCITA na transcrição, a nota é 0. Nunca infira ou assuma.

Retorne um JSON com a seguinte estrutura EXATA (sem markdown, apenas JSON puro):
{
  "spiced_situation": 0,
  "spiced_pain": 0,
  "spiced_impact": 0,
  "spiced_critical_event": 0,
  "spiced_decision": 0,
  "spin_situation": 0,
  "spin_problem": 0,
  "spin_implication": 0,
  "spin_need_payoff": 0,
  "challenger_teach": 0,
  "challenger_tailor": 0,
  "challenger_take_control": 0
}

## RUBRICAS SPICED (escala 0-10)

### spiced_situation
Avalia se o closer mapeou o contexto real do cliente (tamanho empresa, maturidade, softwares, metas de receita).
- 0: Não coletou nenhum contexto. Fez tour de features sem entender o cenário.
- 3: Fez 1-2 perguntas de contexto superficiais (ex: "quantos funcionários?").
- 5: Entendeu o contexto básico mas transformou a call em interrogatório — excesso de perguntas de situação sem avançar para dor.
- 8: Mapeou contexto relevante COM EFICIÊNCIA, conectando situação à dor do cliente sem interrogatório.
- 10: Demonstrou conhecimento prévio do setor, validou rapidamente a situação e avançou para dimensões mais profundas.
PENALIDADE: Se o closer fez mais de 5 perguntas de situação sem conectar à dor, reduza 2 pontos.

### spiced_pain
Avalia se o closer identificou a DOR REAL (não superficial) — o problema subjacente que gera consequências.
- 0: Não identificou nenhuma dor. Ficou apenas em features/produto.
- 3: Identificou dor superficial ("preciso melhorar vendas") sem aprofundar.
- 5: Identificou a dor mas não chegou à raiz — ficou no nível de sintoma.
- 8: "Descascou a cebola" — chegou à dor profunda com consequências claras para o negócio.
- 10: Identificou dor profunda E conectou ao impacto emocional do tomador de decisão (medo, ambição, pressão).

### spiced_impact
Avalia se o closer quantificou o impacto RACIONAL (ROI, custo, perda) E EMOCIONAL (medo, ambição pessoal do comprador).
- 0: Não discutiu nenhum impacto.
- 3: Mencionou impacto genérico ("vai melhorar resultados") sem quantificar.
- 5: Quantificou impacto financeiro/operacional mas esqueceu o impacto emocional do tomador de decisão.
- 8: Conectou dor ao impacto racional COM NÚMEROS e ao impacto emocional do decisor.
- 10: Tangibilizou a "segunda-feira pós-evento" — o cliente verbalizou o impacto de forma específica e emocional.

### spiced_critical_event
Avalia se foi identificado um EVENTO CRÍTICO REAL — um prazo com consequências severas se não cumprido.
DISTINÇÃO CRUCIAL: Evento Crítico REAL = prazo com dor severa se não cumprido. Evento Atraente = prazo desejável mas sem consequência severa.
- 0: Nenhuma urgência identificada. Cliente pode comprar "quando quiser".
- 3: Identificou prazo vago ou "seria bom ter isso logo" (Evento Atraente, não Crítico).
- 5: Identificou urgência mas não confirmou as CONSEQUÊNCIAS da inação.
- 8: Identificou prazo real COM consequências concretas e negativas se não agir.
- 10: Ancorou o deal em um evento crítico irrefutável — cliente verbalizou a dor de não agir até a data.

### spiced_decision
Avalia se o closer mapeou o PROCESSO DE DECISÃO completo (critérios, stakeholders, comitê de compra, próximos passos).
- 0: Não perguntou sobre o processo de decisão.
- 3: Perguntou "quem mais está envolvido?" superficialmente.
- 5: Mapeou stakeholders mas não os critérios de decisão ou próximos passos formais.
- 8: Mapeou stakeholders + critérios + próximo passo concreto com data.
- 10: Orquestrou "Mutual Commit" — próximos passos bilaterais com datas acordadas com todos os decisores.

## RUBRICAS SPIN (escala 0-10)

### spin_situation
- 0: Sem perguntas de situação ou contexto totalmente ausente.
- 5: Fez perguntas de situação adequadas para estabelecer contexto.
- 8: Usou situação com moderação — apenas o necessário para avançar.
- 10: Usou informações conhecidas previamente e validou em vez de perguntar o óbvio.
PENALIDADE: Excesso de perguntas de situação (cliente demonstrou impaciência) → máximo 4.

### spin_problem
- 0: Não explorou problemas ou insatisfações do cliente.
- 5: Identificou problemas explícitos do cliente.
- 8: Transformou necessidades implícitas em explícitas através de perguntas focadas.
- 10: Aprofundou múltiplos problemas interconectados, preparando terreno para implicações.

### spin_implication
- 0: Não explorou consequências dos problemas.
- 5: Mencionou consequências mas de forma superficial.
- 8: Fez o cliente perceber a GRAVIDADE dos problemas — justificando o custo da solução.
- 10: As implicações foram tão bem exploradas que o cliente mesmo verbalizou urgência de resolver.

### spin_need_payoff
- 0: Não fez perguntas de necessidade de solução — foi direto ao pitch.
- 5: Fez perguntas de valor mas de forma mecânica.
- 8: O cliente articulou os benefícios da solução com suas próprias palavras.
- 10: O cliente "ensaiou internamente" — vendeu a solução para si mesmo antes do closer apresentar.

## RUBRICAS CHALLENGER SALE (escala 0-10)

### challenger_teach
Avalia o "Commercial Teaching" — o closer ensinou o cliente sobre um problema oculto do negócio dele.
- 0: Sem nenhum insight ou provocação intelectual. Call foi reativa/diagnóstica.
- 3: Compartilhou alguma informação mas não desafiou as premissas do cliente.
- 5: Trouxe dados ou benchmarks mas sem reframing real.
- 8: Apresentou perspectiva que o cliente não tinha considerado — cliente demonstrou interesse genuíno.
- 10: REFRAME confirmado — cliente disse algo como "nunca tinha pensado nisso dessa forma" ou equivalente. Fluxo: Credibilidade → Reframe → Dados racionais → Impacto emocional.

### challenger_tailor
- 0: Abordagem genérica, sem adaptação ao perfil/persona do cliente.
- 5: Adaptou o discurso ao setor ou cargo do cliente.
- 8: Personalizou baseado na persona (Titan/Builder/Executor), dores específicas e linguagem do cliente.
- 10: A solução foi apresentada exatamente nos termos e prioridades do cliente — cliente sentiu que foi desenhado para ele.

### challenger_take_control
- 0: Closer foi passivo — cliente conduziu a conversa completamente.
- 5: Closer manteve algum controle mas cedeu em momentos-chave.
- 8: Closer conduziu a conversa com assertividade, redirecionou quando necessário.
- 10: Closer estabeleceu autoridade e controle desde o início, inclusive em momentos de resistência — não cedeu a pressão sem valor.

Avalie com base EXCLUSIVAMENTE no que foi dito. Se não houver evidência, dê 0. Seja rigoroso.`

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { callAI } from '../_shared/ai-client.ts'

async function callOpenAI(system: string, userContent: string, userId?: string): Promise<string> {
  const { content } = await callAI({
    model: OPENAI_MODEL,
    system,
    user: userContent,
    maxTokens: 2048,
    responseFormat: 'json_object',
    userId: userId || 'system',
    functionName: 'analyze-call'
  })
  return content
}

function parseJSON<T>(text: string): T | null {
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean) as T
  } catch {
    console.error('[analyze-call] JSON parse error. Raw text:', text.slice(0, 200))
    return null
  }
}

function buildTranscriptText(rawTranscript: unknown[]): string {
  if (!Array.isArray(rawTranscript)) return ''
  return rawTranscript
    .map((seg: unknown) => {
      const s = seg as { speaker?: string; words?: string; start_time?: number }
      const ts = s.start_time != null ? `[${Math.round(s.start_time)}s] ` : ''
      return `${ts}${s.speaker ?? 'Speaker'}: ${s.words ?? ''}`
    })
    .join('\n')
}

// ─── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const startedAt = nowMs()
    const { call_id } = await req.json()
    if (!call_id) return errorResponse('Missing call_id', 400)
    logStep({ function_name: 'analyze-call', call_id, step: 'start', status: 'start' })


    const supabase = getSupabaseClient()

    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, deal_id, deal_stage, deal_acv, lead_perfil, seller_email')
      .eq('id', call_id)
      .single()

    if (callError || !call) return errorResponse('Call not found', 404)

    console.log(`[analyze-call] AI path — OpenAI ${OPENAI_MODEL} for call ${call_id}`)

    const { data: existingAnalysis } = await supabase
      .from('call_analysis')
      .select('transcript_raw, talk_ratio_seller, talk_ratio_client, longest_monologue_s, questions_count, analysis_json')
      .eq('call_id', call_id)
      .single()

    const rawTranscript: unknown[] = (existingAnalysis?.transcript_raw as unknown[]) ?? []
    const transcriptText = buildTranscriptText(rawTranscript)

    if (!transcriptText) {
      console.warn(`[analyze-call] No transcript text found for call ${call_id} — cannot run AI analysis`)
      return errorResponse('No transcript available for analysis', 422)
    }

    // Fetch active smart trackers to inject into prompts
    const { data: trackers, error: trackersError } = await supabase
      .from('smart_trackers')
      .select('name, description, category')
      .eq('is_active', true)

    if (trackersError) {
      console.warn(`[analyze-call] Failed to fetch smart_trackers: ${trackersError.message} — continuing without trackers`)
    }

    const trackersContext = trackers && trackers.length > 0
      ? `\n\nTRACKERS CONFIGURADOS (detecte menções na transcrição):\n${trackers.map(t => `- ${t.name} (${t.category}): ${t.description}`).join('\n')}`
      : ''

    const dealContext = [
      call.deal_stage ? `Etapa do funil: ${call.deal_stage}` : null,
      call.deal_acv ? `ACV do deal: R$ ${call.deal_acv}` : null,
      call.lead_perfil ? `Perfil do lead: ${call.lead_perfil}` : null,
      call.seller_email ? `Closer: ${call.seller_email}` : null,
    ].filter(Boolean).join(' | ')

    const userMessage = `${dealContext ? `Contexto do deal: ${dealContext}\n\n` : ''}${trackersContext ? trackersContext + '\n\n' : ''}TRANSCRIÇÃO DA CALL:\n\n${transcriptText}`

    const trackersSection = trackers && trackers.length > 0
      ? `\n\n## SMART TRACKERS A DETECTAR\nAlem da analise SPICED/SPIN/Challenger, identifique na transcricao se os seguintes comportamentos ocorreram:\n${trackers.map(t => `- ${t.name}${t.description ? ': ' + t.description : ''}`).join('\n')}\nPara cada tracker detectado, adicione ao JSON final: "smart_trackers_detected": ["nome_do_tracker1", "nome_do_tracker2"]`
      : ''

    const methodologySystemWithTrackers = METHODOLOGY_SYSTEM + trackersSection

    const [brieferRaw, methodologyRaw] = await Promise.all([
      callOpenAI(BRIEFER_SYSTEM, userMessage),
      callOpenAI(methodologySystemWithTrackers, userMessage),
    ])

    console.log(`[analyze-call] OpenAI responses received for call ${call_id}`)

    type BrieferResult = {
      summary_text?: string
      client_pains?: unknown[]
      next_steps?: unknown[]
      critical_moments?: unknown[]
      competitors?: unknown[]
      objections?: unknown[]
      churn_signals?: unknown[]
      buy_intent_signals?: unknown[]
      next_action?: {
        action: string
        timing: string
        main_argument: string
      }
    }
    type ScoresResult = {
      spiced_situation?: number
      spiced_pain?: number
      spiced_impact?: number
      spiced_critical_event?: number
      spiced_decision?: number
      spin_situation?: number
      spin_problem?: number
      spin_implication?: number
      spin_need_payoff?: number
      challenger_teach?: number
      challenger_tailor?: number
      challenger_take_control?: number
      smart_trackers_detected?: string[]
    }

    const briefer = parseJSON<BrieferResult>(brieferRaw) ?? {}
    const scores = parseJSON<ScoresResult>(methodologyRaw) ?? {}

    const spicedTotal = [
      scores.spiced_situation, scores.spiced_pain, scores.spiced_impact,
      scores.spiced_critical_event, scores.spiced_decision,
    ].filter(v => v != null).reduce((a, b) => a + b!, 0) / 5

    const spinTotal = [
      scores.spin_situation, scores.spin_problem,
      scores.spin_implication, scores.spin_need_payoff,
    ].filter(v => v != null).reduce((a, b) => a + b!, 0) / 4

    const challengerTotal = [
      scores.challenger_teach, scores.challenger_tailor, scores.challenger_take_control,
    ].filter(v => v != null).reduce((a, b) => a + b!, 0) / 3

    const mergedAnalysisJson = {
      ...(existingAnalysis?.analysis_json as Record<string, unknown> ?? {}),
      ...(briefer.next_action ? { next_action: briefer.next_action } : {}),
    }

    await supabase.from('call_analysis').upsert({
      call_id,
      summary_text: briefer.summary_text ?? null,
      client_pains: briefer.client_pains ?? [],
      next_steps: briefer.next_steps ?? [],
      critical_moments: briefer.critical_moments ?? [],
      competitors: briefer.competitors ?? [],
      objections: briefer.objections ?? [],
      churn_signals: briefer.churn_signals ?? [],
      buy_intent_signals: briefer.buy_intent_signals ?? [],
      smart_trackers_detected: scores.smart_trackers_detected ?? [],
      analysis_json: mergedAnalysisJson,
      talk_ratio_seller: existingAnalysis?.talk_ratio_seller ?? null,
      talk_ratio_client: existingAnalysis?.talk_ratio_client ?? null,
      longest_monologue_s: existingAnalysis?.longest_monologue_s ?? null,
      questions_count: existingAnalysis?.questions_count ?? null,
    }, { onConflict: 'call_id' })

    await supabase.from('calls').update({
      processing_status: 'analyzed',
      processed_at: new Date().toISOString(),
    }).eq('id', call_id)

    console.log(`[analyze-call] Analysis complete for call ${call_id} — SPICED ${spicedTotal.toFixed(1)} / SPIN ${spinTotal.toFixed(1)} / Challenger ${challengerTotal.toFixed(1)}`)
    logStep({
      function_name: 'analyze-call',
      call_id,
      step: 'analysis_complete',
      status: 'ok',
      duration_ms: nowMs() - startedAt,
      details: { spiced_total: spicedTotal, spin_total: spinTotal, challenger_total: challengerTotal },
    })

    return jsonResponse({
      ok: true,
      call_id,
      mode: 'ai',
      scores: { spiced_total: spicedTotal, spin_total: spinTotal, challenger_total: challengerTotal },
    })
  } catch (err) {
    logStep({
      function_name: 'analyze-call',
      step: 'analysis_complete',
      status: 'error',
      details: { message: err instanceof Error ? err.message : 'Unexpected error' },
    })
    console.error('[analyze-call] Unexpected error:', err)
    return errorResponse(`Internal server error: ${(err as Error).message}`, 500)
  }
})
