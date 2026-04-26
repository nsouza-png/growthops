export type OpsCallRow = {
  id: string
  deal_id: string | null
  seller_email: string
  seller_name: string | null
  prospect_name: string | null
  processing_status: string | null
  transcript_fetched?: boolean | null
  rag_index_status?: string | null
  rag_index_started_at?: string | null
  rag_enrich_status?: string | null
  rag_enrich_started_at?: string | null
  updated_at: string
  created_at: string
  deal_stage: string | null
  deal_status: string | null
  deal_acv: number | null
  lead_perfil: string | null
  lead_faixa: string | null
  lead_segmento: string | null
  utm_campaign: string | null
  origem_da_receita: string | null
}

export function normalizeStatus(value?: string | null) {
  return (value ?? 'unknown').toLowerCase()
}

export function buildOpsRecommendation(row: OpsCallRow): string {
  const status = normalizeStatus(row.processing_status)
  if (status === 'partially_enriched') return 'Reprocessar enrich-call (deal parcial no Databricks)'
  if (status === 'enrich_failed') return 'Reprocessar enrich-call e revisar DATABRICKS_TOKEN/deal_id'
  if (status === 'transcript_failed' || status === 'fetch_failed') return 'Reprocessar fetch-transcript e validar tl;dv API'
  if (status === 'fetching_transcript') return 'Acompanhar logs; se travar > 15min, destravar lock com checklist'
  if (status === 'pending') return 'Aguardando TranscriptReady; validar evento webhook'
  if (row.rag_index_status === 'failed') return 'Reindexar RAG da call'
  if (row.rag_enrich_status === 'failed') return 'Reexecutar enriquecimento RAG'
  return 'Fluxo saudável'
}

export function databricksCompleteness(row: OpsCallRow) {
  const checks = [
    row.deal_stage,
    row.deal_status,
    row.deal_acv != null ? String(row.deal_acv) : null,
    row.lead_perfil,
    row.lead_faixa,
    row.lead_segmento,
    row.utm_campaign,
    row.origem_da_receita,
  ]
  const filled = checks.filter(Boolean).length
  const total = checks.length
  const pct = Math.round((filled / total) * 100)
  return { filled, total, pct }
}

