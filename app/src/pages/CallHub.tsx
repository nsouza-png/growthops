import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, UserRound, Filter, Flame, Thermometer, Snowflake, Phone, ChevronLeft, Radio } from 'lucide-react'
import { useUnifiedCalls } from '../hooks/useUnifiedCalls'
import ScoreRing from '../components/ui/ScoreRing'
import InsightDrawer from '../components/InsightDrawer'
import { cn } from '../lib/cn'
import { useRole } from '../contexts/RoleContext'
import { CallHubSkeleton } from '../components/ui/SkeletonLoader'
import { EmptyState } from '../components/ui/EmptyState'

type Period = 'all' | 'week' | 'month' | 'quarter'

const TEMP_ICON: Record<string, React.ReactNode> = {
  QUENTE: <Flame size={11} className="text-signal-red" />,
  MORNO: <Thermometer size={11} className="text-signal-amber" />,
  FRIO: <Snowflake size={11} className="text-signal-blue" />,
}

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'week', label: '7 dias' },
  { value: 'month', label: '30 dias' },
  { value: 'quarter', label: '90 dias' },
]

const PAGE_SIZE = 50

function fmtBRDate(d: string | null) {
  if (!d) return '—'
  const [datePart] = d.split(' ')
  const [dd, mm] = datePart.split('/')
  if (!dd || !mm) return d
  return `${dd}/${mm}`
}

export default function CallHub() {
  const navigate = useNavigate()
  const { isAdmin, viewedRole, simulatedCloser, setSimulatedCloser } = useRole()

  const [search, setSearch] = useState('')
  const [filterPeriod, setFilterPeriod] = useState<Period>('all')
  const [filterTemp, setFilterTemp] = useState<string>('all')
  const [filterVendedor, setFilterVendedor] = useState<string>('all')
  const [filterProduto, setFilterProduto] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [openInsightId, setOpenInsightId] = useState<number | null>(null)
  const [page, setPage] = useState(0)

  const daysAgo =
    filterPeriod === 'week' ? 7 :
    filterPeriod === 'month' ? 30 :
    filterPeriod === 'quarter' ? 90 :
    null

  const { rows: allRows, loading } = useUnifiedCalls({
    limit: 500,
    daysAgo,
    vendedor: filterVendedor !== 'all' ? filterVendedor : null,
  })

  // Derive dropdown lists from loaded rows
  const vendedores = useMemo(
    () => [...new Set(allRows.map(r => r.vendedor).filter((v): v is string => Boolean(v)))],
    [allRows],
  )
  const produtos = useMemo(
    () => [...new Set(allRows.map(r => r.deal_produto ?? r.produto_oferecido).filter((p): p is string => Boolean(p)))],
    [allRows],
  )
  const closers = useMemo(
    () => [...new Set(allRows.map(r => r.closer_email).filter((c): c is string => Boolean(c)))],
    [allRows],
  )

  // Reset page when filters change
  function handleFilterChange<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPage(0)
    }
  }

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = allRows
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        (r.vendedor ?? '').toLowerCase().includes(q) ||
        (r.lead ?? '').toLowerCase().includes(q) ||
        (r.deal_id ?? '').toLowerCase().includes(q) ||
        (r.deal_produto ?? '').toLowerCase().includes(q) ||
        (r.produto_oferecido ?? '').toLowerCase().includes(q),
      )
    }
    if (filterTemp !== 'all') {
      result = result.filter(r => r.temperatura_identificada === filterTemp)
    }
    if (filterProduto !== 'all') {
      result = result.filter(r =>
        (r.deal_produto ?? r.produto_oferecido) === filterProduto,
      )
    }
    return result
  }, [allRows, search, filterTemp, filterProduto])

  const total = filtered.length
  const pageStart = total === 0 ? 0 : page * PAGE_SIZE + 1
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, total)
  const hasMore = pageEnd < total
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const activeFiltersCount = [
    filterTemp !== 'all',
    filterVendedor !== 'all',
    filterProduto !== 'all',
  ].filter(Boolean).length

  function scoreColor(s: number | null) {
    if (s == null) return 'text-text-tertiary'
    if (s >= 7) return 'text-signal-green'
    if (s >= 4) return 'text-signal-amber'
    return 'text-signal-red'
  }

  // suppress unused warning
  void scoreColor

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-eyebrow">Execucao</p>
          <h1 className="text-2xl font-bold">Central de Execucao de Calls</h1>
          <p className="text-sm text-text-tertiary mt-1">Gerencie, analise e priorize conversas que impactam diretamente a receita.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/calls/live')}
            className="flex items-center gap-2 px-4 py-2 bg-g4-red text-white text-sm font-semibold rounded-xl hover:bg-g4-red/90 transition-all"
          >
            <Radio size={14} />
            Live Call
          </button>
          <div className="text-text-tertiary text-sm">{total} calls</div>
        </div>
      </div>

      {/* Closer picker — admin in executivo view */}
      {isAdmin && viewedRole === 'executivo' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-signal-blue/10 border border-signal-blue/30 rounded-xl">
          <UserRound size={13} className="text-signal-blue shrink-0" />
          <span className="text-xs text-signal-blue font-semibold">Simulando closer:</span>
          <select
            value={simulatedCloser ?? ''}
            onChange={e => setSimulatedCloser(e.target.value || null)}
            className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer"
          >
            <option value="">— Todos —</option>
            {closers.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={e => handleFilterChange(setSearch)(e.target.value)}
            placeholder="Buscar por closer, lead, deal ID, produto..."
            className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid transition-colors"
          />
        </div>
        {/* Period quick filter */}
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.value}
              onClick={() => handleFilterChange(setFilterPeriod)(p.value)}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                filterPeriod === p.value
                  ? 'bg-g4-red text-white'
                  : 'bg-bg-card border border-border text-text-secondary hover:text-text-primary',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
            showFilters || activeFiltersCount > 0
              ? 'bg-signal-blue/15 border-signal-blue/40 text-signal-blue'
              : 'bg-bg-card border-border text-text-secondary hover:text-text-primary',
          )}
        >
          <Filter size={12} />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-signal-blue text-white text-[9px] font-bold flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 p-4 bg-bg-card2 border border-border rounded-2xl">
          {/* Temperatura */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Temperatura</span>
            <div className="flex gap-1">
              {['all', 'QUENTE', 'MORNO', 'FRIO'].map(t => (
                <button
                  key={t}
                  onClick={() => handleFilterChange(setFilterTemp)(t)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1',
                    filterTemp === t
                      ? 'bg-g4-red text-white'
                      : 'bg-bg-elevated border border-border text-text-secondary hover:text-text-primary',
                  )}
                >
                  {t !== 'all' && TEMP_ICON[t]}
                  {t === 'all' ? 'Todas' : t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Vendedor */}
          {vendedores.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Vendedor</span>
              <select
                value={filterVendedor}
                onChange={e => handleFilterChange(setFilterVendedor)(e.target.value)}
                className="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-mid"
              >
                <option value="all">Todos</option>
                {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}

          {/* Produto */}
          {produtos.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Produto</span>
              <select
                value={filterProduto}
                onChange={e => handleFilterChange(setFilterProduto)(e.target.value)}
                className="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-mid"
              >
                <option value="all">Todos</option>
                {produtos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {activeFiltersCount > 0 && (
            <button
              onClick={() => {
                handleFilterChange(setFilterTemp)('all')
                handleFilterChange(setFilterVendedor)('all')
                handleFilterChange(setFilterProduto)('all')
              }}
              className="self-end text-xs text-text-tertiary hover:text-text-secondary underline underline-offset-2"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <CallHubSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Phone} title="Nenhuma call encontrada" description="Ajuste os filtros ou aguarde novas calls." />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px_32px] gap-4 px-5 py-3 border-b border-border sticky top-0 bg-bg-base z-10">
            {['Vendedor', 'Lead', 'Produto', 'Segmento', 'Data', 'Score', ''].map(h => (
              <span key={h} className="section-eyebrow">{h}</span>
            ))}
          </div>
          {pageRows.map(row => (
            <div
              key={row.id}
              onClick={() => setOpenInsightId(row.id)}
              className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px_32px] gap-4 px-5 py-3.5 border-b border-border/50 hover:bg-bg-card2 cursor-pointer transition-colors items-center group"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{row.vendedor ?? '—'}</div>
                <div className="text-xs text-text-tertiary truncate">
                  {row.deal_id ? `Deal ${row.deal_id}` : row.perfil_do_lead ?? ''}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-sm text-text-secondary truncate">{row.lead ?? '—'}</div>
              </div>
              <span className="text-xs text-text-secondary truncate">
                {row.deal_produto ?? row.produto_oferecido ?? '—'}
              </span>
              <span className="text-xs text-text-secondary truncate">
                {row.deal_lead_segmento ?? row.segmento_lead ?? '—'}
              </span>
              <div className="flex items-center gap-1.5">
                {row.temperatura_identificada && TEMP_ICON[row.temperatura_identificada]}
                <span className="text-xs text-text-secondary">{fmtBRDate(row.sort_date ?? row.data)}</span>
              </div>
              <div className="flex items-center gap-2">
                <ScoreRing
                  score={
                    row.spiced_total != null ? row.spiced_total / 10 :
                    row.score_geral != null ? row.score_geral / 10 :
                    null
                  }
                  size="sm"
                />
              </div>
              <ChevronRight size={14} className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
              page === 0
                ? 'border-border text-text-tertiary cursor-not-allowed opacity-40'
                : 'bg-bg-card border-border text-text-secondary hover:text-text-primary',
            )}
          >
            <ChevronLeft size={13} />
            Anterior
          </button>

          <span className="text-xs text-text-tertiary">
            Mostrando {pageStart}–{pageEnd} de {total} calls
          </span>

          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
              !hasMore
                ? 'border-border text-text-tertiary cursor-not-allowed opacity-40'
                : 'bg-bg-card border-border text-text-secondary hover:text-text-primary',
            )}
          >
            Próxima
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      <InsightDrawer insightId={openInsightId} onClose={() => setOpenInsightId(null)} />
    </div>
  )
}
