import { describe, expect, it } from 'vitest'
import { buildOpsRecommendation, databricksCompleteness, type OpsCallRow } from './pipelineOps'

function row(overrides: Partial<OpsCallRow>): OpsCallRow {
  return {
    id: '1',
    deal_id: '123',
    seller_email: 'a@g4.com',
    seller_name: null,
    prospect_name: null,
    processing_status: 'pending',
    transcript_fetched: false,
    rag_index_status: 'idle',
    rag_index_started_at: null,
    rag_enrich_status: 'idle',
    rag_enrich_started_at: null,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    deal_stage: null,
    deal_status: null,
    deal_acv: null,
    lead_perfil: null,
    lead_faixa: null,
    lead_segmento: null,
    utm_campaign: null,
    origem_da_receita: null,
    ...overrides,
  }
}

describe('pipeline ops recommendation', () => {
  it('prioritizes partially_enriched recommendation', () => {
    expect(buildOpsRecommendation(row({ processing_status: 'partially_enriched' }))).toContain('Databricks')
  })

  it('returns healthy message for good states', () => {
    expect(buildOpsRecommendation(row({ processing_status: 'analyzed' }))).toContain('saudável')
  })
})

describe('databricks completeness', () => {
  it('computes completion percentage', () => {
    const c = databricksCompleteness(row({ deal_stage: 'x', deal_status: 'y', deal_acv: 10 }))
    expect(c.filled).toBe(3)
    expect(c.total).toBe(8)
    expect(c.pct).toBe(38)
  })
})

