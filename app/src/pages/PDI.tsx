import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Target, Plus, TrendingUp, TrendingDown, BookOpen } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { usePDI } from '../hooks/usePDI'
import { useRole } from '../contexts/RoleContext'
import ScoreRing from '../components/ui/ScoreRing'
import { cn } from '../lib/cn'

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getMilestoneBadge(score: number) {
  if (score >= 8) return { label: 'Top Performer', className: 'bg-signal-green/10 text-signal-green' }
  if (score >= 6) return { label: 'Progredindo', className: 'bg-signal-blue/10 text-signal-blue' }
  return { label: 'Desenvolvendo', className: 'bg-signal-amber/10 text-signal-amber' }
}

function getPriorityStyles(priority: 1 | 2 | 3) {
  if (priority === 1) return { badge: 'bg-g4-red/20 text-g4-red', label: 'P1' }
  if (priority === 2) return { badge: 'bg-signal-amber/20 text-signal-amber', label: 'P2' }
  return { badge: 'bg-signal-blue/20 text-signal-blue', label: 'P3' }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card border border-border rounded-lg px-3 py-2 text-xs">
      <p className="text-text-tertiary mb-1">{label}</p>
      {payload.map(entry => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function PDI() {
  const { closerEmail: paramEmail } = useParams<{ closerEmail?: string }>()
  const { viewedRole, isAdmin } = useRole()
  const isCoordOrAdmin = isAdmin || viewedRole === 'coordenador'
  const navigate = useNavigate()

  const { data, loading, error, toggleGoal, addGoal } = usePDI(paramEmail)

  const [showNewGoalInput, setShowNewGoalInput] = useState(false)
  const [newGoalText, setNewGoalText] = useState('')

  async function handleAddGoal() {
    const text = newGoalText.trim()
    if (!text) return
    await addGoal(text)
    setNewGoalText('')
    setShowNewGoalInput(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
        <div className="w-6 h-6 rounded-full border-2 border-g4-red border-t-transparent animate-spin mr-3" />
        Carregando PDI...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-signal-red text-sm">
        Erro ao carregar PDI: {error}
      </div>
    )
  }

  const hasPDIData = data && (data.focusAreas.length > 0 || data.sprintGoals.length > 0)

  // Current sprint week display
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  const sprintLabel = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  const studyPath = paramEmail ? `/pdi/study/${paramEmail}` : '/pdi/study'
  const libraryPath = '/pdi/library'

  if (!hasPDIData) {
    return (
      <div className="p-6 space-y-6 max-w-6xl">
        {/* Desenvolvimento CTAs — always accessible */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate(studyPath)}
            className="flex-1 flex items-center justify-between gap-4 bg-g4-golden/8 border border-g4-golden/20 rounded-xl px-5 py-4 hover:bg-g4-golden/12 hover:border-g4-golden/35 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-g4-golden/15 flex items-center justify-center shrink-0">
                <BookOpen size={16} className="text-g4-golden" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-text-primary">Sessões de Estudo</p>
                <p className="text-xs text-text-tertiary mt-0.5">Plano gerado a partir das suas calls</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-g4-golden group-hover:translate-x-0.5 transition-transform">→</span>
          </button>
          <button
            onClick={() => navigate(libraryPath)}
            className="flex-1 flex items-center justify-between gap-4 bg-bg-card border border-border rounded-xl px-5 py-4 hover:bg-bg-elevated hover:border-border-mid transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0">
                <BookOpen size={16} className="text-text-secondary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-text-primary">Biblioteca</p>
                <p className="text-xs text-text-tertiary mt-0.5">Snippets curados para estudo</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-text-tertiary group-hover:translate-x-0.5 transition-transform">→</span>
          </button>
        </div>

        {/* Empty state for PDI config */}
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center">
            <Target size={28} className="text-text-tertiary" />
          </div>
          <div>
            <h3 className="text-text-primary font-semibold text-lg">PDI não configurado</h3>
            <p className="text-text-secondary text-sm mt-1 max-w-xs">
              O coordenador irá definir suas áreas de foco em breve.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const delta = data.currentScore - data.squadAvgScore
  const deltaPositive = delta >= 0
  const milestone = getMilestoneBadge(data.currentScore)

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Desenvolvimento CTAs */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate(studyPath)}
          className="flex-1 flex items-center justify-between gap-4 bg-g4-golden/8 border border-g4-golden/20 rounded-xl px-5 py-4 hover:bg-g4-golden/12 hover:border-g4-golden/35 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-g4-golden/15 flex items-center justify-center shrink-0">
              <BookOpen size={16} className="text-g4-golden" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-text-primary">Sessões de Estudo</p>
              <p className="text-xs text-text-tertiary mt-0.5">Plano gerado a partir das suas calls</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-g4-golden group-hover:translate-x-0.5 transition-transform">→</span>
        </button>
        <button
          onClick={() => navigate(libraryPath)}
          className="flex-1 flex items-center justify-between gap-4 bg-bg-card border border-border rounded-xl px-5 py-4 hover:bg-bg-elevated hover:border-border-mid transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0">
              <BookOpen size={16} className="text-text-secondary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-text-primary">Biblioteca</p>
              <p className="text-xs text-text-tertiary mt-0.5">Snippets curados para estudo</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-text-tertiary group-hover:translate-x-0.5 transition-transform">→</span>
        </button>
      </div>

      {/* Header Card */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Left: Avatar + info */}
          <div className="flex items-center gap-4 flex-1">
            <div
              className="w-12 h-12 rounded-full bg-g4-red flex items-center justify-center text-white font-bold text-lg shrink-0"
            >
              {getInitials(data.closerName)}
            </div>
            <div>
              <div className="text-text-primary font-semibold text-base">{data.closerName}</div>
              <div className="text-text-tertiary text-xs">{data.closerEmail}</div>
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-bg-elevated text-text-secondary uppercase tracking-widest">
                Executivo
              </span>
            </div>
          </div>

          {/* Center: Score Ring */}
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={data.currentScore / 10} size="lg" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Score Atual</span>
          </div>

          {/* Right: vs squad + milestone */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {deltaPositive ? (
                <TrendingUp size={14} className="text-signal-green" />
              ) : (
                <TrendingDown size={14} className="text-signal-red" />
              )}
              <span
                className={cn(
                  'text-sm font-bold',
                  deltaPositive ? 'text-signal-green' : 'text-signal-red',
                )}
              >
                {deltaPositive ? '+' : ''}{delta.toFixed(1)} pts
              </span>
              <span className="text-text-tertiary text-xs">vs Squad Avg</span>
            </div>
            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-bold',
                milestone.className,
              )}
            >
              {milestone.label}
            </span>
          </div>
        </div>
      </div>

      {/* Evolution Chart */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="section-eyebrow">Performance Evolution</p>
            <h3 className="text-text-primary font-semibold">Score vs Média do Squad</h3>
          </div>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-g4-red" />
              <span className="text-text-secondary">Você</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
              <span className="text-text-secondary">Média do Squad</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.weeklyScores} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ display: 'none' }}
            />
            <Line
              type="monotone"
              dataKey="score"
              name="Você"
              stroke="#B9915B"
              strokeWidth={2}
              dot={{ r: 3, fill: '#B9915B' }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="squadAvg"
              name="Média do Squad"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: '#3b82f6' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Focus Areas */}
      {data.focusAreas.length > 0 && (
        <div>
          <p className="section-eyebrow mb-3">Áreas de Foco</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.focusAreas.map(area => {
              const ps = getPriorityStyles(area.priority)
              const progressPct = Math.min(100, (area.currentScore / 10) * 100)
              return (
                <div
                  key={area.id}
                  className="bg-bg-card border border-border rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-bold',
                          ps.badge,
                        )}
                      >
                        {ps.label}
                      </span>
                      <span className="section-eyebrow">{area.dimension}</span>
                    </div>
                    <ScoreRing score={area.currentScore / 10} size="sm" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-text-tertiary mb-1">
                      <span>Atual: {area.currentScore}</span>
                      <span>Meta: {area.targetScore}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-g4-red rounded-full transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary">{area.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sprint Goals */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="section-eyebrow">Sprint Goals</p>
            <h3 className="text-text-primary font-semibold">
              Metas desta semana
              <span className="ml-2 text-xs font-normal text-text-tertiary">
                Semana de {sprintLabel}
              </span>
            </h3>
          </div>
          {isCoordOrAdmin && (
            <button
              onClick={() => setShowNewGoalInput(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-g4-red/10 text-g4-red hover:bg-g4-red/20 transition-colors text-xs font-semibold"
            >
              <Plus size={13} />
              Nova meta
            </button>
          )}
        </div>

        {showNewGoalInput && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newGoalText}
              onChange={e => setNewGoalText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
              placeholder="Descreva a meta..."
              className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-g4-red/40 transition-colors"
            />
            <button
              onClick={handleAddGoal}
              className="px-4 py-2 bg-g4-red text-white rounded-lg text-sm font-medium hover:bg-g4-red/90 transition-colors"
            >
              Adicionar
            </button>
            <button
              onClick={() => { setShowNewGoalInput(false); setNewGoalText('') }}
              className="px-3 py-2 bg-bg-elevated text-text-secondary rounded-lg text-sm hover:bg-bg-elevated/80 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {data.sprintGoals.length === 0 ? (
          <p className="text-text-tertiary text-sm">Nenhuma meta definida para esta semana.</p>
        ) : (
          <ul className="space-y-3">
            {data.sprintGoals.map(goal => (
              <li key={goal.id} className="flex items-start gap-3">
                <button
                  onClick={() => toggleGoal(goal.id, !goal.completed)}
                  className={cn(
                    'mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all',
                    goal.completed
                      ? 'bg-g4-red border-g4-red'
                      : 'border-border bg-transparent hover:border-g4-red/50',
                  )}
                >
                  {goal.completed && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span
                  className={cn(
                    'text-sm transition-colors',
                    goal.completed ? 'text-text-tertiary line-through' : 'text-text-primary',
                  )}
                >
                  {goal.goalText}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
