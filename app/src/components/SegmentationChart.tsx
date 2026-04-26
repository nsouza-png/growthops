import { useState, useEffect } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'

interface DealPoint {
  id: string
  name: string
  acv: number
  spiced_score: number | null
  deal_stage: string | null
  deal_status: string | null
  is_current: boolean
  segment: 'Enterprise' | 'Mid-Market' | 'SMB'
}

interface SegmentationChartProps {
  currentCallId: string
  currentAcv: number | null
}

function getSegment(acv: number): 'Enterprise' | 'Mid-Market' | 'SMB' {
  if (acv >= 50000) return 'Enterprise'
  if (acv >= 15000) return 'Mid-Market'
  return 'SMB'
}

function useDealsData(currentCallId: string, currentAcv: number | null) {
  const [points, setPoints] = useState<DealPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('calls')
        .select('id, closer_email, deal_id, deal_acv, deal_stage, deal_status')
        .not('deal_acv', 'is', null)
        .order('call_date', { ascending: false })
        .limit(100)

      if (!data) { setLoading(false); return }

      const ids = data.map((r: { id: string }) => r.id)
      const { data: scores } = ids.length
        ? await supabase.from('framework_scores').select('call_id, spiced_total').in('call_id', ids)
        : { data: [] }

      const scoreMap: Record<string, number | null> = {}
      for (const s of scores ?? []) {
        scoreMap[(s as { call_id: string; spiced_total: number | null }).call_id] =
          (s as { call_id: string; spiced_total: number | null }).spiced_total
      }

      const mapped: DealPoint[] = data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => ({
          id: row.id,
          name: row.closer_email?.split('@')[0] ?? row.deal_id ?? row.id.slice(0, 6),
          acv: Number(row.deal_acv),
          spiced_score: scoreMap[row.id] != null ? Number(scoreMap[row.id]) : null,
          deal_stage: row.deal_stage,
          deal_status: row.deal_status,
          is_current: row.id === currentCallId,
          segment: getSegment(Number(row.deal_acv)),
        }))
        .filter((p: DealPoint) => p.spiced_score != null)

      setPoints(mapped)
      setLoading(false)
    }
    load()
  }, [currentCallId, currentAcv])

  return { points, loading }
}

function pointColor(point: DealPoint): string {
  if (point.is_current) return '#ef4444'
  if (
    point.deal_status?.toLowerCase().includes('ganho') ||
    point.deal_stage?.toLowerCase().includes('fecha')
  ) return '#22c55e'
  if (
    point.deal_status?.toLowerCase().includes('perdi') ||
    point.deal_status?.toLowerCase().includes('perdido')
  ) return '#6b7280'
  return '#3b82f6'
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: DealPoint }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const fmt = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="bg-bg-card border border-border rounded-xl p-3 text-xs space-y-1 shadow-xl">
      <p className="font-semibold text-text-primary">
        {d.is_current ? '>>> Deal atual <<<' : d.name}
      </p>
      <p className="text-text-secondary">ACV: <span className="font-semibold text-signal-amber">{fmt(d.acv)}</span></p>
      <p className="text-text-secondary">Score SPICED: <span className="font-semibold">{d.spiced_score?.toFixed(1)}/10</span></p>
      {d.deal_stage && <p className="text-text-secondary">Estagio: {d.deal_stage}</p>}
      {d.deal_status && <p className="text-text-secondary">Status: {d.deal_status}</p>}
      <p className="text-text-tertiary">{d.segment}</p>
    </div>
  )
}

// Componente customizado para renderizar pontos com raio variável
function CustomDot(props: {
  cx?: number
  cy?: number
  payload?: DealPoint
}) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || !payload) return null
  const r = payload.is_current ? 10 : 5
  const fill = pointColor(payload)
  const opacity = payload.is_current ? 1 : 0.65
  const stroke = payload.is_current ? '#ffffff' : 'none'
  const strokeWidth = payload.is_current ? 2 : 0

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      fillOpacity={opacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  )
}

export function SegmentationChart({ currentCallId, currentAcv }: SegmentationChartProps) {
  const { points, loading } = useDealsData(currentCallId, currentAcv)
  const [segFilter, setSegFilter] = useState<'Todos' | 'Enterprise' | 'Mid-Market' | 'SMB'>('Todos')

  const filtered = segFilter === 'Todos'
    ? points
    : points.filter(p => p.segment === segFilter || p.is_current)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-text-tertiary text-sm gap-2">
        <div className="w-4 h-4 rounded-full border-2 border-g4-red border-t-transparent animate-spin" />
        Carregando dados similares...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtro de segmento */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-tertiary">Segmento:</span>
        {(['Todos', 'Enterprise', 'Mid-Market', 'SMB'] as const).map(seg => (
          <button
            key={seg}
            onClick={() => setSegFilter(seg)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
              segFilter === seg
                ? 'bg-g4-red text-white'
                : 'bg-bg-card2 border border-border text-text-secondary hover:text-text-primary'
            )}
          >
            {seg}
          </button>
        ))}
        <span className="text-xs text-text-tertiary ml-auto">
          {filtered.length} deals
        </span>
      </div>

      {/* ScatterChart */}
      <div className="card">
        <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">
          ACV x Score SPICED — Deals historicos
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" />
            <XAxis
              type="number"
              dataKey="spiced_score"
              name="Score SPICED"
              domain={[0, 10]}
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Score SPICED', position: 'insideBottom', offset: -4, fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
            />
            <YAxis
              type="number"
              dataKey="acv"
              name="ACV"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(v)
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Scatter
              data={filtered}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              shape={(props: any) => <CustomDot {...props} />}
            >
              {filtered.map((entry) => (
                <Cell
                  key={entry.id}
                  fill={pointColor(entry)}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs text-text-tertiary">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-signal-red border-2 border-white/40" />
          <span>Deal atual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-signal-green" />
          <span>Ganho / Fechado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-signal-blue" />
          <span>Em aberto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span>Perdido</span>
        </div>
      </div>
    </div>
  )
}
