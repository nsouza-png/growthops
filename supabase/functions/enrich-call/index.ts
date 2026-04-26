/**
 * enrich-call
 * Queries Databricks production.gold.deals_fct using the deal_id extracted
 * from the call's tl;dv meeting name.
 * Enriches the `calls` row with deal context and triggers fetch-transcript.
 */

import { getSupabaseClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase.ts'
import { logStep, nowMs } from '../_shared/observability.ts'
import { canStartEnrich } from '../_shared/pipeline-locks.mjs'

const DATABRICKS_HOST = Deno.env.get('DATABRICKS_HOST') ?? 'https://dbc-8acefaf9-a170.cloud.databricks.com'
const DATABRICKS_WAREHOUSE = Deno.env.get('DATABRICKS_WAREHOUSE') ?? 'bbae754ea44f67e0'
const DATABRICKS_SQL_ENDPOINT = `${DATABRICKS_HOST}/api/2.0/sql/statements`

interface DatabricksResult {
  status: { state: string }
  result?: { data_array?: string[][] }
  manifest?: { schema?: { columns?: Array<{ name: string }> } }
}

async function queryDatabricks(sql: string): Promise<Record<string, string | null> | null> {
  const token = Deno.env.get('DATABRICKS_TOKEN')
  if (!token) {
    console.warn('[enrich-call] DATABRICKS_TOKEN not set — skipping enrichment')
    return null
  }

  const res = await fetch(DATABRICKS_SQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      warehouse_id: DATABRICKS_WAREHOUSE,
      statement: sql,
      wait_timeout: '30s',
      on_wait_timeout: 'CONTINUE',
    }),
  })

  if (!res.ok) {
    console.error('[enrich-call] Databricks HTTP error:', res.status, await res.text())
    return null
  }

  const json: DatabricksResult = await res.json()

  if (json.status?.state !== 'SUCCEEDED') {
    console.warn('[enrich-call] Databricks query not succeeded:', json.status?.state)
    return null
  }

  const columns = json.manifest?.schema?.columns?.map((c) => c.name) ?? []
  const row = json.result?.data_array?.[0]
  if (!row || row.length === 0) return null

  return Object.fromEntries(columns.map((col, i) => [col, row[i] ?? null]))
}

Deno.serve(async (req) => {
  let callId: string | null = null

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const startedAt = nowMs()
    const { call_id } = await req.json()
    callId = typeof call_id === 'string' ? call_id : null
    if (!call_id) return errorResponse('Missing call_id', 400)

    const supabase = getSupabaseClient()
    logStep({ function_name: 'enrich-call', call_id, step: 'start', status: 'start' })

    const { data: statusRow, error: statusError } = await supabase
      .from('calls')
      .select('id, processing_status')
      .eq('id', call_id)
      .single()
    if (statusError || !statusRow) {
      await supabase.from('calls').update({ processing_status: 'enrich_failed' }).eq('id', call_id)
      return errorResponse('Call not found', 404)
    }
    if (!canStartEnrich(statusRow.processing_status)) {
      logStep({
        function_name: 'enrich-call',
        call_id,
        step: 'lock',
        status: 'skip',
        duration_ms: nowMs() - startedAt,
        details: { reason: 'already_processing_or_completed' },
      })
      return jsonResponse({ ok: true, call_id, skipped: true, reason: 'already_processing_or_completed' })
    }
    const { data: lockRows } = await supabase
      .from('calls')
      .update({ processing_status: 'enriching' })
      .eq('id', call_id)
      .in('processing_status', ['pending', 'enrich_failed'])
      .select('id')
    if (!lockRows || lockRows.length === 0) {
      logStep({
        function_name: 'enrich-call',
        call_id,
        step: 'lock',
        status: 'skip',
        duration_ms: nowMs() - startedAt,
        details: { reason: 'lost_race_for_lock' },
      })
      return jsonResponse({ ok: true, call_id, skipped: true, reason: 'lost_race_for_lock' })
    }

    // Fetch call record
    const { data: call, error: fetchError } = await supabase
      .from('calls')
      .select('id, deal_id, tldv_call_id')
      .eq('id', call_id)
      .single()

    if (fetchError || !call) {
      await supabase.from('calls').update({ processing_status: 'enrich_failed' }).eq('id', call_id)
      return errorResponse('Call not found', 404)
    }

    let enrichment: Record<string, unknown> = { processing_status: 'enriched' }

    if (call.deal_id) {
      // Sanitize deal_id — must be numeric (extracted via regex \[(\d+)\] in tldv-webhook)
      const sanitizedDealId = String(call.deal_id).replace(/[^0-9]/g, '')
      if (!sanitizedDealId) {
        console.warn(`[enrich-call] deal_id "${call.deal_id}" is not numeric — skipping Databricks query`)
        return jsonResponse({ ok: true, call_id, enriched: false })
      }

      const deal = await queryDatabricks(`
        SELECT
          stage_name, status_do_deal, valor_da_oportunidade,
          perfil, cargo, faixa_de_faturamento, segmento,
          proprietario_name, qualificador_name,
          utm_campaign, origem_da_receita
        FROM production.gold.deals_fct
        WHERE deal_id = '${sanitizedDealId}'
        LIMIT 1
      `)

      if (deal) {
        enrichment = {
          processing_status: 'enriched',
          deal_stage: deal['stage_name'] ?? null,
          deal_status: deal['status_do_deal'] ?? null,
          deal_acv: deal['valor_da_oportunidade'] ? parseFloat(deal['valor_da_oportunidade'] as string) : null,
          lead_perfil: deal['perfil'] ?? null,
          lead_faixa: deal['faixa_de_faturamento'] ?? null,
          lead_segmento: deal['segmento'] ?? null,
          utm_campaign: deal['utm_campaign'] ?? null,
          origem_da_receita: deal['origem_da_receita'] ?? null,
        }
        console.log(`[enrich-call] Enriched call ${call_id} with deal ${call.deal_id}`)
      } else {
        console.warn(`[enrich-call] No deal found in Databricks for deal_id=${call.deal_id} — marking as partially_enriched`)
        enrichment = { processing_status: 'partially_enriched' }
      }
    } else {
      console.warn(`[enrich-call] No deal_id on call ${call_id} — marking as partially_enriched`)
      enrichment = { processing_status: 'partially_enriched' }
    }

    // Update call record
    await supabase.from('calls').update(enrichment).eq('id', call_id)

    // Trigger fetch-transcript asynchronously
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    fetch(`${supabaseUrl}/functions/v1/fetch-transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ call_id }),
    }).catch((err) => console.error('[enrich-call] Failed to invoke fetch-transcript:', err))

    logStep({
      function_name: 'enrich-call',
      call_id,
      step: 'enrich',
      status: 'ok',
      duration_ms: nowMs() - startedAt,
      details: { enriched: Boolean(enrichment.deal_stage) },
    })
    return jsonResponse({ ok: true, call_id, enriched: !!enrichment.deal_stage })
  } catch (err) {
    if (callId) {
      const supabase = getSupabaseClient()
      await supabase.from('calls').update({ processing_status: 'enrich_failed' }).eq('id', callId)
    }
    logStep({
      function_name: 'enrich-call',
      step: 'enrich',
      status: 'error',
      details: { message: err instanceof Error ? err.message : 'Unexpected error' },
    })
    console.error('[enrich-call] Unexpected error:', err)
    return errorResponse('Internal server error', 500)
  }
})
