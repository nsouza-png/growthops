import { useState } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from 'recharts'
import {
  Target, HelpCircle, Swords, AlertCircle, TrendingUp, Shield, Lightbulb, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '../lib/cn'
import ScoreRing from './ui/ScoreRing'
import type { MethodologyScores as FrameworkScoreRow } from '../types/database'

// ── Types ────────────────────────────────────────────────────────────────────
type Framework = 'SPICED' | 'SPIN' | 'Challenger'

interface Props {
  scores: FrameworkScoreRow | null
  /** Rich JSON from call_analysis.analysis_json (already parsed) */
  richJson: any | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function barColor(pct: number): string {
  if (pct >= 70) return 'bg-signal-green'
  if (pct >= 40) return 'bg-signal-amber'
  return 'bg-signal-red'
}

function radarFill(framework: Framework): string {
  if (framework === 'SPICED') return '#ef4444'   // red-ish matching g4
  if (framework === 'SPIN') return '#3b82f6'      // blue
  return '#f59e0b'                                 // amber
}

function radarStroke(framework: Framework): string {
  if (framework === 'SPICED') return '#dc2626'
  if (framework === 'SPIN') return '#2563eb'
  return '#d97706'
}

function classificationBadge(cls: string | null) {
  if (!cls) return null
  const lower = cls.toLowerCase()
  const color =
    lower.includes('expert') || lower.includes('alto') || lower.includes('strong') ? 'bg-signal-green/10 text-signal-green border-signal-green/20' :
    lower.includes('medio') || lower.includes('developing') || lower.includes('inter') ? 'bg-signal-amber/10 text-signal-amber border-signal-amber/20' :
    'bg-signal-red/10 text-signal-red border-signal-red/20'
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', color)}>
      {cls}
    </span>
  )
}

// ── Score bar with 0-max scale ───────────────────────────────────────────────
function DimensionBar({ label, value, max, isWeak, suffix }: {
  label: string; value: number | null; max: number; isWeak?: boolean; suffix?: string
}) {
  const pct = value != null ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className={cn(
      'flex items-center justify-between py-2 border-b border-border/40 last:border-0',
      isWeak && 'bg-signal-red/5 -mx-2 px-2 rounded-lg',
    )}>
      <span className={cn('text-sm', isWeak ? 'text-signal-red font-semibold' : 'text-text-secondary')}>
        {label}
        {isWeak && <span className="text-[10px] ml-1.5 text-signal-red/70">(fraca)</span>}
      </span>
      <div className="flex items-center gap-2">
        <div className="w-24 bg-bg-elevated rounded-full h-1.5">
          <div
            className={cn('h-1.5 rounded-full transition-all', value != null ? barColor(pct) : '')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-bold w-12 text-right tabular-nums">
          {value != null ? `${value}${suffix ?? `/${max}`}` : '--'}
        </span>
      </div>
    </div>
  )
}

// ── Red flags list ───────────────────────────────────────────────────────────
function RedFlagsList({ flags }: { flags: string[] }) {
  if (!flags.length) return null
  return (
    <div>
      <p className="section-eyebrow mb-2">Red Flags</p>
      <div className="space-y-1.5">
        {flags.map((flag, i) => (
          <div key={i} className="flex gap-2 p-2.5 bg-signal-red/5 border border-signal-red/15 rounded-lg">
            <AlertCircle size={12} className="text-signal-red shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary leading-relaxed">{flag}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Coaching card ────────────────────────────────────────────────────────────
function CoachingCard({ title, text, exampleQuestion }: {
  title: string; text: string; exampleQuestion?: string
}) {
  return (
    <div className="p-3 bg-g4-golden/8 border border-g4-golden/20 rounded-xl space-y-2">
      <p className="section-eyebrow text-g4-golden">{title}</p>
      <p className="text-xs text-text-secondary leading-relaxed">{text}</p>
      {exampleQuestion && (
        <div className="mt-2 p-2 bg-bg-card rounded-lg border border-border">
          <p className="text-[10px] text-text-tertiary mb-1 uppercase tracking-wider">Pergunta modelo</p>
          <p className="text-xs text-text-primary italic">"{exampleQuestion}"</p>
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function MethodologyScoresPanel({ scores, richJson }: Props) {
  const [framework, setFramework] = useState<Framework>('SPICED')
  const [consolidatedOpen, setConsolidatedOpen] = useState(true)

  const TABS: { id: Framework; label: string; icon: typeof Target }[] = [
    { id: 'SPICED', label: 'SPICED', icon: Target },
    { id: 'SPIN', label: 'SPIN', icon: HelpCircle },
    { id: 'Challenger', label: 'Challenger', icon: Swords },
  ]

  // ── SPICED data ──────────────────────────────────────────────────────────
  const spicedDims = [
    { key: 'situation',       label: 'Situacao',        dbField: scores?.spiced_situation_score,      richField: richJson?.spiced?.scores?.situation },
    { key: 'pain',            label: 'Dor',             dbField: scores?.spiced_pain_score,           richField: richJson?.spiced?.scores?.pain },
    { key: 'impact',          label: 'Impacto',         dbField: scores?.spiced_impact_score,         richField: richJson?.spiced?.scores?.impact },
    { key: 'critical_event',  label: 'Evento Critico',  dbField: scores?.spiced_critical_event_score, richField: richJson?.spiced?.scores?.critical_event },
    { key: 'decision',        label: 'Decisao',         dbField: scores?.spiced_decision_score,       richField: richJson?.spiced?.scores?.decision },
    { key: 'delivery',        label: 'Entrega',         dbField: scores?.spiced_delivery_score,       richField: richJson?.spiced?.scores?.delivery },
  ]
  // Filter out delivery if null
  const spicedActive = spicedDims.filter(d => {
    const val = d.richField?.score ?? d.dbField
    return val != null
  })
  const spicedWeak = scores?.spiced_weak_dimension ?? richJson?.spiced?.weak_dimension ?? null
  const spicedTotal = richJson?.spiced?.score_total ?? scores?.spiced_total ?? null
  const spicedRedFlags: string[] = richJson?.spiced?.red_flags ?? (scores?.spiced_red_flags as string[] | null) ?? []
  const spicedCoaching = richJson?.spiced?.coaching_recommendation ?? null
  const spicedNextSteps = scores?.spiced_next_steps ?? richJson?.spiced?.next_steps ?? null
  const spicedClassification = scores?.spiced_classification ?? richJson?.spiced?.classification?.result ?? null

  const spicedRadar = spicedActive.map(d => ({
    dimension: d.label,
    value: d.richField?.score ?? d.dbField ?? 0,
    fullMark: 10,
  }))

  // ── SPIN data ────────────────────────────────────────────────────────────
  const spinDims = [
    { key: 'situation',   label: 'Situacao',    count: scores?.spin_situation_count   ?? richJson?.spin?.question_map?.situation?.count   ?? null },
    { key: 'problem',     label: 'Problema',    count: scores?.spin_problem_count     ?? richJson?.spin?.question_map?.problem?.count     ?? null },
    { key: 'implication', label: 'Implicacao',  count: scores?.spin_implication_count ?? richJson?.spin?.question_map?.implication?.count ?? null },
    { key: 'need_payoff', label: 'Need-Payoff', count: scores?.spin_need_payoff_count ?? richJson?.spin?.question_map?.need_payoff?.count ?? null },
  ]
  const spinTotal = richJson?.spin?.scores?.total ?? scores?.spin_total_score ?? null
  const spinSequence = scores?.spin_sequence_analysis ?? richJson?.spin?.sequence_analysis?.summary ?? null
  const spinMissed: string[] = richJson?.spin?.top_missed_questions ?? (scores?.spin_missed_questions as string[] | null) ?? []
  const spinCoaching = richJson?.spin?.coaching_priority ?? null

  const spinMaxCount = Math.max(...spinDims.map(d => d.count ?? 0), 1)
  const spinRadar = spinDims.map(d => ({
    dimension: d.label,
    value: d.count ?? 0,
    fullMark: spinMaxCount,
  }))

  // ── Challenger data ──────────────────────────────────────────────────────
  const challDims = [
    { key: 'teach',   label: 'Teach',        score: richJson?.challenger?.scores?.teach?.score        ?? scores?.challenger_teach_score   ?? null },
    { key: 'tailor',  label: 'Tailor',       score: richJson?.challenger?.scores?.tailor?.score       ?? scores?.challenger_tailor_score  ?? null },
    { key: 'control', label: 'Take Control', score: richJson?.challenger?.scores?.take_control?.score ?? scores?.challenger_control_score ?? null },
  ]
  const challTotal = richJson?.challenger?.score_total ?? scores?.challenger_total ?? null
  const challClassification = scores?.challenger_classification ?? richJson?.challenger?.classification ?? null
  const challRedFlags: string[] = richJson?.challenger?.red_flags ?? (scores?.challenger_red_flags as string[] | null) ?? []
  const challCoaching = richJson?.challenger?.coaching_recommendation ?? null

  const challRadar = challDims.map(d => ({
    dimension: d.label,
    value: d.score ?? 0,
    fullMark: 10,
  }))

  // ── Consolidated ─────────────────────────────────────────────────────────
  const consolidated = richJson?.consolidated ?? null
  const overallQuality = scores?.overall_quality ?? consolidated?.overall_quality ?? null
  const topStrength = scores?.top_strength ?? consolidated?.top_strength ?? null
  const topGap = scores?.top_gap ?? consolidated?.top_gap ?? null
  const dealRisk = scores?.deal_risk ?? consolidated?.deal_risk ?? null
  const crossInsight = scores?.cross_framework_insight ?? consolidated?.cross_framework_insight ?? null
  const priorityCoaching = scores?.priority_coaching ?? consolidated?.priority_coaching ?? null

  if (!scores && !richJson) {
    return <p className="text-text-tertiary text-sm py-4">Scores ainda nao disponiveis.</p>
  }

  return (
    <div className="space-y-4">
      {/* ── Framework tab bar ─────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-bg-card2 p-1 rounded-xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setFramework(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all',
              framework === id
                ? 'bg-g4-red text-white shadow-sm'
                : 'text-text-tertiary hover:text-text-primary',
            )}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* ── SPICED ────────────────────────────────────────────────────────── */}
      {framework === 'SPICED' && (
        <div className="space-y-4">
          {/* Radar chart */}
          {spicedRadar.length >= 3 && (
            <div className="bg-bg-card2 border border-border rounded-xl p-3">
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={spicedRadar}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                  <Radar
                    dataKey="value"
                    stroke={radarStroke('SPICED')}
                    fill={radarFill('SPICED')}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Total + classification */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ScoreRing score={spicedTotal != null ? Math.min((spicedTotal / 30) * 10, 10) : null} size="md" />
              <div>
                <p className="text-sm font-bold">SPICED Total</p>
                <p className="text-xs text-text-tertiary">{spicedTotal ?? '--'}/30</p>
              </div>
            </div>
            {classificationBadge(spicedClassification)}
          </div>

          {/* Dimension bars */}
          <div className="space-y-0.5">
            {spicedActive.map(d => {
              const val = d.richField?.score ?? d.dbField ?? null
              const isWeak = spicedWeak != null && d.key.toLowerCase().includes(spicedWeak.toLowerCase())
              return (
                <div key={d.key}>
                  <DimensionBar label={d.label} value={val} max={10} isWeak={isWeak} />
                  {d.richField?.key_excerpt && (
                    <p className="text-[11px] text-text-tertiary italic pl-2 border-l-2 border-border mt-1 mb-2 leading-relaxed">
                      "{d.richField.key_excerpt}"
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Red flags */}
          <RedFlagsList flags={spicedRedFlags} />

          {/* Coaching */}
          {spicedCoaching && (
            <CoachingCard
              title={`Coaching -- ${spicedCoaching.dimension_focus ?? 'SPICED'}`}
              text={spicedCoaching.recommendation}
              exampleQuestion={spicedCoaching.example_question}
            />
          )}
          {typeof scores?.spiced_coaching_rec === 'string' && scores.spiced_coaching_rec && !spicedCoaching && (
            <CoachingCard title="Coaching SPICED" text={scores.spiced_coaching_rec} />
          )}

          {/* Next steps */}
          {spicedNextSteps && (
            <div className="p-3 bg-bg-card2 border border-border rounded-xl">
              <p className="section-eyebrow mb-1">Proximos passos</p>
              <p className="text-xs text-text-secondary leading-relaxed">{spicedNextSteps}</p>
            </div>
          )}
        </div>
      )}

      {/* ── SPIN ──────────────────────────────────────────────────────────── */}
      {framework === 'SPIN' && (
        <div className="space-y-4">
          {/* Radar chart */}
          {spinRadar.length >= 3 && (
            <div className="bg-bg-card2 border border-border rounded-xl p-3">
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={spinRadar}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, spinMaxCount]} tick={false} axisLine={false} />
                  <Radar
                    dataKey="value"
                    stroke={radarStroke('SPIN')}
                    fill={radarFill('SPIN')}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ScoreRing score={spinTotal != null ? Math.min(spinTotal, 10) : null} size="md" />
              <div>
                <p className="text-sm font-bold">SPIN Total</p>
                <p className="text-xs text-text-tertiary">{spinTotal ?? '--'}</p>
              </div>
            </div>
          </div>

          {/* Dimension bars (counts) */}
          <div className="space-y-0.5">
            {spinDims.map(d => (
              <DimensionBar
                key={d.key}
                label={d.label}
                value={d.count}
                max={spinMaxCount}
                suffix={`x`}
              />
            ))}
          </div>

          {/* Sequence analysis */}
          {spinSequence && (
            <div className="p-3 bg-bg-card2 border border-border rounded-xl">
              <p className="section-eyebrow mb-1">Analise de Sequencia</p>
              <p className="text-xs text-text-secondary leading-relaxed">{spinSequence}</p>
            </div>
          )}

          {/* Question distribution */}
          {richJson?.spin?.sequence_analysis?.proportion && (
            <div className="p-3 bg-bg-card2 border border-border rounded-xl">
              <p className="section-eyebrow mb-2">Distribuicao de Perguntas</p>
              {(['situation_pct', 'problem_pct', 'implication_pct', 'need_payoff_pct'] as const).map((key) => {
                const labels: Record<string, string> = {
                  situation_pct: 'Situacao', problem_pct: 'Problema',
                  implication_pct: 'Implicacao', need_payoff_pct: 'Need-Payoff',
                }
                const val = richJson.spin.sequence_analysis.proportion[key] as number
                return (
                  <div key={key} className="flex items-center gap-2 py-1">
                    <span className="text-xs text-text-tertiary w-24 shrink-0">{labels[key]}</span>
                    <div className="flex-1 bg-bg-elevated rounded-full h-1.5">
                      <div
                        className={cn('h-1.5 rounded-full', val === 0 ? 'bg-signal-red' : val >= 30 ? 'bg-signal-green' : 'bg-signal-amber')}
                        style={{ width: `${val}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold w-8 text-right">{val.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Missed questions */}
          {spinMissed.length > 0 && (
            <div>
              <p className="section-eyebrow mb-2">Perguntas que Faltaram</p>
              <div className="space-y-1.5">
                {spinMissed.map((q, i) => (
                  <div key={i} className="flex gap-2 p-2.5 bg-signal-blue/5 border border-signal-blue/15 rounded-lg">
                    <span className="text-signal-blue text-xs font-bold shrink-0 mt-0.5">?</span>
                    <p className="text-xs text-text-secondary italic leading-relaxed">"{q}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coaching */}
          {spinCoaching && (
            <CoachingCard
              title={`Coaching -- ${spinCoaching.weakest_category ?? 'SPIN'}`}
              text={spinCoaching.recommendation}
              exampleQuestion={spinCoaching.example_question}
            />
          )}
          {typeof scores?.spin_coaching_priority === 'string' && scores.spin_coaching_priority && !spinCoaching && (
            <CoachingCard title="Coaching SPIN" text={scores.spin_coaching_priority} />
          )}
        </div>
      )}

      {/* ── Challenger ────────────────────────────────────────────────────── */}
      {framework === 'Challenger' && (
        <div className="space-y-4">
          {/* Radar chart */}
          {challRadar.length >= 3 && (
            <div className="bg-bg-card2 border border-border rounded-xl p-3">
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={challRadar}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                  <Radar
                    dataKey="value"
                    stroke={radarStroke('Challenger')}
                    fill={radarFill('Challenger')}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Total + classification */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ScoreRing score={challTotal != null ? Math.min((challTotal / 30) * 10, 10) : null} size="md" />
              <div>
                <p className="text-sm font-bold">Challenger Total</p>
                <p className="text-xs text-text-tertiary">{challTotal ?? '--'}/30</p>
              </div>
            </div>
            {classificationBadge(challClassification)}
          </div>

          {/* Dimension bars */}
          <div className="space-y-0.5">
            {challDims.map(d => (
              <DimensionBar key={d.key} label={d.label} value={d.score} max={10} />
            ))}
          </div>

          {/* Red flags */}
          <RedFlagsList flags={challRedFlags} />

          {/* Coaching */}
          {challCoaching && (
            <CoachingCard
              title={`Coaching -- ${challCoaching.pillar_focus ?? challCoaching.dimension_focus ?? 'Challenger'}`}
              text={challCoaching.recommendation}
              exampleQuestion={challCoaching.example_question}
            />
          )}
          {typeof scores?.challenger_coaching_rec === 'string' && scores.challenger_coaching_rec && !challCoaching && (
            <CoachingCard title="Coaching Challenger" text={scores.challenger_coaching_rec} />
          )}
        </div>
      )}

      {/* ── Consolidated (always visible) ─────────────────────────────────── */}
      {(overallQuality || topStrength || topGap || dealRisk || crossInsight || priorityCoaching) && (
        <div className="border-t border-border pt-4">
          <button
            onClick={() => setConsolidatedOpen(o => !o)}
            className="flex items-center gap-2 w-full text-left mb-3"
          >
            <Shield size={13} className="text-text-tertiary" />
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Sintese Cross-Framework</span>
            {consolidatedOpen
              ? <ChevronUp size={12} className="text-text-tertiary ml-auto" />
              : <ChevronDown size={12} className="text-text-tertiary ml-auto" />}
          </button>

          {consolidatedOpen && (
            <div className="space-y-3">
              {/* Quality + Risk row */}
              <div className="flex items-center gap-2 flex-wrap">
                {overallQuality && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-signal-blue/10 text-signal-blue border-signal-blue/20">
                    Qualidade: {overallQuality}
                  </span>
                )}
                {dealRisk && (
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                    dealRisk === 'alto' ? 'bg-signal-red/10 text-signal-red border-signal-red/20' :
                    dealRisk === 'medio' ? 'bg-signal-amber/10 text-signal-amber border-signal-amber/20' :
                    'bg-signal-green/10 text-signal-green border-signal-green/20',
                  )}>
                    Risco: {dealRisk}
                  </span>
                )}
              </div>

              {/* Strength / Gap */}
              {(topStrength || topGap) && (
                <div className="grid grid-cols-2 gap-2">
                  {topStrength && (
                    <div className="p-2.5 bg-signal-green/5 border border-signal-green/15 rounded-lg">
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp size={11} className="text-signal-green" />
                        <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Forca</p>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">{topStrength}</p>
                    </div>
                  )}
                  {topGap && (
                    <div className="p-2.5 bg-signal-red/5 border border-signal-red/15 rounded-lg">
                      <div className="flex items-center gap-1 mb-1">
                        <AlertCircle size={11} className="text-signal-red" />
                        <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Gap</p>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">{topGap}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Cross-framework insight */}
              {crossInsight && (
                <div className="p-3 bg-bg-card2 border border-border rounded-xl">
                  <p className="section-eyebrow mb-1">Insight Cross-Framework</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{crossInsight}</p>
                </div>
              )}

              {/* Priority coaching */}
              {priorityCoaching && (
                <div className="flex gap-2 p-3 bg-g4-golden/8 border border-g4-golden/20 rounded-xl">
                  <Lightbulb size={13} className="text-g4-golden shrink-0 mt-0.5" />
                  <div>
                    <p className="section-eyebrow text-g4-golden mb-1">Acao prioritaria</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{priorityCoaching}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
