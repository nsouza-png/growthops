import { useEffect, useMemo, useState } from 'react'
import { RefreshCcw, AlertTriangle, Database, Wand2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRole } from '../contexts/RoleContext'
import type { Call } from '../types/database'
import { buildOpsRecommendation, databricksCompleteness, normalizeStatus, type OpsCallRow } from '../features/ops/pipelineOps'

type ActionType = 'enrich-call' | 'fetch-transcript' | 'rag-index-transcript' | 'rag-enrich-call'

const PROCESS_FILTERS = ['all', 'pending', 'enriching', 'partially_enriched', 'fetching_transcript', 'transcript_failed', 'enrich_failed', 'analyzed'] as const

export default function Operations() {
  const { isAdmin } = useRole()
  const [rows, setRows] = useState<OpsCallRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<(typeof PROCESS_FILTERS)[number]>('all')
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState<Record<string, boolean>>({})

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('calls')
      .select('id,deal_id,seller_email,seller_name,prospect_name,processing_status,transcript_fetched,rag_index_status,rag_index_started_at,rag_enrich_status,rag_enrich_started_at,updated_at,created_at,deal_stage,deal_status,deal_acv,lead_perfil,lead_faixa,lead_segmento,utm_campaign,origem_da_receita')
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) {
      setError(error.message)
      setRows([])
    } else {
      setRows((data ?? []) as unknown as OpsCallRow[])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    return rows.filter((r) => normalizeStatus(r.processing_status) === filter)
  }, [rows, filter])

  async function runAction(callId: string, action: ActionType) {
    setRunning((s) => ({ ...s, [`${callId}:${action}`]: true }))
    try {
      const { error } = await supabase.functions.invoke(action, { body: { call_id: callId } })
      if (error) throw error
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao executar ação')
    } finally {
      setRunning((s) => ({ ...s, [`${callId}:${action}`]: false }))
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-xl border border-signal-amber/30 bg-signal-amber/5 text-sm text-text-secondary">
          Acesso restrito: Operations é exclusivo para admin.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <div className="flex items-end justify-between">
        <div>
          <p className="section-eyebrow">Operations</p>
          <h1 className="text-2xl font-bold">Pipeline Health</h1>
          <p className="text-xs text-text-tertiary mt-1">Status operacional, exceções e transparência Databricks</p>
        </div>
        <button onClick={load} className="btn-ghost">
          <RefreshCcw size={14} /> Atualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROCESS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              filter === f ? 'bg-g4-red text-white border-g4-red' : 'bg-bg-card2 border-border text-text-secondary'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-signal-red/30 bg-signal-red/5 text-sm text-signal-red">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-text-tertiary">Carregando operações...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-text-tertiary">Nenhuma call para o filtro selecionado.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const completion = databricksCompleteness(row)
            const recommendation = buildOpsRecommendation(row)
            const status = normalizeStatus(row.processing_status)
            return (
              <div key={row.id} className="card border border-border/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{row.prospect_name ?? row.deal_id ?? row.id}</p>
                    <p className="text-xs text-text-tertiary">
                      {row.seller_name ?? row.seller_email} · deal_id: {row.deal_id ?? '—'}
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="badge badge-blue">status: {status}</span>
                      <span className="badge badge-blue">rag_index: {row.rag_index_status ?? '—'}</span>
                      <span className="badge badge-blue">rag_enrich: {row.rag_enrich_status ?? '—'}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-text-tertiary">
                    <div>updated: {new Date(row.updated_at).toLocaleString()}</div>
                    <div>transcript: {row.transcript_fetched ? 'ok' : 'pendente'}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-bg-card2 border border-border/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary flex items-center gap-1">
                      <Database size={11} /> Databricks enrichment
                    </p>
                    <p className="text-sm mt-1">
                      Completude: <span className="font-bold">{completion.pct}%</span> ({completion.filled}/{completion.total})
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      stage={row.deal_stage ?? '—'} · status={row.deal_status ?? '—'} · acv={row.deal_acv ?? '—'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-bg-card2 border border-border/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary flex items-center gap-1">
                      <AlertTriangle size={11} /> Ação recomendada
                    </p>
                    <p className="text-sm mt-1">{recommendation}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(['enrich-call', 'fetch-transcript', 'rag-index-transcript', 'rag-enrich-call'] as ActionType[]).map((action) => (
                    <button
                      key={action}
                      onClick={() => runAction(row.id, action)}
                      disabled={Boolean(running[`${row.id}:${action}`])}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-bg-elevated text-text-secondary hover:text-text-primary disabled:opacity-40"
                    >
                      <Wand2 size={12} className="inline mr-1" />
                      {running[`${row.id}:${action}`] ? 'Executando...' : `Reprocessar ${action}`}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

