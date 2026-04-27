import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, MessageSquare, Scissors, Star, Zap, TrendingUp, AlertCircle,
  X, Check, Briefcase, CheckCircle2, ChevronDown, ChevronUp, User, Calendar,
  Clock, ExternalLink, Users,
} from 'lucide-react'
import { useCall } from '../hooks/useCalls'
import ScoreRing from '../components/ui/ScoreRing'
import CallFeedbackModal from '../components/CallFeedbackModal'
import MethodologyScoresPanel from '../components/MethodologyScores'
import InteractiveTranscript from '../components/InteractiveTranscript'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../contexts/RoleContext'
import { cn } from '../lib/cn'
import { supabase } from '../lib/supabase'
import type { CallFeedback } from '../types/database'
import { FollowUpModal } from '../components/FollowUpModal'
import { NextActionCard } from '../components/NextActionCard'
import { SegmentationChart } from '../components/SegmentationChart'
import { DecisionBanner, buildCallDecision } from '../components/DecisionBanner'
import { buildSnippetInsertPayload } from '../features/game-film/utils'

type Tab = 'briefer' | 'trackers' | 'methodology' | 'feedback' | 'deal' | 'similares'
type FeedbackType = 'Geral' | 'Melhoria' | 'Acerto' | 'Urgente'

// ScoreBar and framework tab logic moved to MethodologyScores component

function TranscriptLine({ speaker, text, isCloser }: { speaker: string; text: string; isCloser: boolean }) {
  return (
    <div className={cn('flex gap-3 py-3 border-b border-border/30', isCloser ? '' : 'opacity-80')}>
      <div className={cn('w-2 h-2 rounded-full mt-2 shrink-0', isCloser ? 'bg-signal-blue' : 'bg-signal-green')} />
      <div className="flex-1">
        <span className={cn('text-xs font-bold uppercase tracking-wider mr-2', isCloser ? 'text-signal-blue' : 'text-signal-green')}>
          {speaker}
        </span>
        <span className="text-sm text-text-secondary leading-relaxed">{text}</span>
      </div>
    </div>
  )
}

const SNIPPET_TAGS = ['objecao', 'spin', 'spiced', 'challenger', 'exemplo', 'abertura', 'fechamento']

function CreateSnippetModal({ callId, onClose, onCreated }: { callId: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [tag, setTag] = useState('objecao')
  const [excerpt, setExcerpt] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function save() {
    if (!title.trim() || !excerpt.trim()) return
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    await supabase
      .from('snippets')
      .insert(
        buildSnippetInsertPayload({
          callId,
          title,
          excerpt,
          tag,
          userId: userData?.user?.id ?? null,
        }),
      )
    setSaving(false)
    setDone(true)
    setTimeout(() => { onCreated(); onClose() }, 900)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Criar Game Film</h2>
            <p className="text-xs text-text-tertiary mt-0.5">Salvar trecho como snippet de aprendizado</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-text-tertiary mb-1 block">Título</label>
            <input
              autoFocus type="text"
              placeholder="Ex: Contorno de objeção de preço"
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-bg-card2 border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
            />
          </div>
          <div>
            <label className="text-xs text-text-tertiary mb-1 block">Tag</label>
            <div className="flex flex-wrap gap-1.5">
              {SNIPPET_TAGS.map(t => (
                <button key={t} onClick={() => setTag(t)}
                  className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                    tag === t ? 'bg-g4-red text-white' : 'bg-bg-card2 border border-border text-text-secondary hover:text-text-primary'
                  )}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-tertiary mb-1 block">Trecho da transcrição</label>
            <textarea
              placeholder="Cole o trecho relevante da call aqui..."
              value={excerpt} onChange={e => setExcerpt(e.target.value)}
              rows={4}
              className="w-full bg-bg-card2 border border-border rounded-xl px-3 py-2.5 text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={save} disabled={saving || done || !title.trim() || !excerpt.trim()}
            className={cn('btn-primary flex-1 justify-center disabled:opacity-50', done && 'bg-signal-green border-signal-green')}>
            {done ? <><Check size={14} /> Salvo!</> : saving ? 'Salvando...' : <><Scissors size={14} /> Salvar snippet</>}
          </button>
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── Speaker Timeline ──────────────────────────────────────────────────────────
type SpeakerSegment = { speaker: 'closer' | 'client'; start_s: number; end_s: number }

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function SpeakerTimeline({ talkRatioSeller, durationS, speakerSegments, longestMonologueS, questionsCount, objectionsCount }: {
  talkRatioSeller: number; durationS: number | null; speakerSegments: SpeakerSegment[] | null
  longestMonologueS: number | null; questionsCount: number | null; objectionsCount: number
}) {
  const [open, setOpen] = useState(true)
  const clientRatio = 100 - talkRatioSeller

  return (
    <div className="px-4 py-3 border-b border-border/40">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 w-full text-left mb-2">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Quem falou mais</span>
        {open ? <ChevronUp size={12} className="text-text-tertiary ml-auto" /> : <ChevronDown size={12} className="text-text-tertiary ml-auto" />}
      </button>
      {open && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-signal-blue" />
              <span className="text-text-tertiary uppercase tracking-wider font-semibold">Closer</span>
              <span className="text-text-primary font-bold ml-1">{talkRatioSeller.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-signal-green" />
              <span className="text-text-tertiary uppercase tracking-wider font-semibold">Lead</span>
              <span className="text-text-primary font-bold ml-1">{clientRatio.toFixed(0)}%</span>
            </div>
          </div>
          <div className="flex rounded-full overflow-hidden h-2 gap-0.5">
            <div className="bg-signal-blue rounded-l-full" style={{ width: `${talkRatioSeller}%` }} />
            <div className="bg-signal-green rounded-r-full flex-1" />
          </div>
          {speakerSegments && speakerSegments.length > 0 && durationS && durationS > 0 && (
            <div className="relative h-5 bg-white/5 rounded-full overflow-hidden">
              {speakerSegments.map((seg, i) => (
                <div key={i}
                  className={cn('absolute top-0 h-full', seg.speaker === 'closer' ? 'bg-signal-blue' : 'bg-signal-green')}
                  style={{ left: `${(seg.start_s / durationS) * 100}%`, width: `${((seg.end_s - seg.start_s) / durationS) * 100}%` }}
                />
              ))}
            </div>
          )}
          <div className="flex gap-4 text-xs text-text-tertiary flex-wrap">
            {durationS != null && <span>Duração: <span className="text-text-secondary font-semibold">{formatDuration(durationS)}</span></span>}
            {longestMonologueS != null && (
              <span>Monólogo: <span className={cn('font-semibold', longestMonologueS > 180 ? 'text-signal-amber' : 'text-text-secondary')}>{formatDuration(longestMonologueS)}</span></span>
            )}
            {questionsCount != null && <span>Perguntas: <span className="text-text-secondary font-semibold">{questionsCount}</span></span>}
            {objectionsCount > 0 && <span>Objeções: <span className="text-signal-red font-semibold">{objectionsCount}</span></span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Override form ─────────────────────────────────────────────────────────────
function OverrideForm({ scoresId, initial, note }: { scoresId: string; initial: number | null; note: string | null }) {
  const [value, setValue] = useState(initial?.toString() ?? '')
  const [noteText, setNoteText] = useState(note ?? '')
  const [saved, setSaved] = useState(false)

  async function save() {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0 || num > 10) return
    await supabase
      .from('framework_scores').update({ coordinator_override: num, override_note: noteText.trim() || null }).eq('id', scoresId)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mt-4 p-3 bg-bg-card2 rounded-xl border border-border space-y-2">
      <p className="section-eyebrow">Override do coordenador</p>
      <div className="flex gap-2">
        <input type="number" min={0} max={10} step={0.1} value={value} onChange={e => setValue(e.target.value)}
          placeholder="Score final (0–10)"
          className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
        />
        <button onClick={save} className={cn('btn-ghost px-3 text-xs', saved ? 'text-signal-green' : '')}>
          {saved ? <Check size={13} /> : 'Salvar'}
        </button>
      </div>
      <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)}
        placeholder="Justificativa (opcional)"
        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
      />
    </div>
  )
}

// ── Feedback helpers ──────────────────────────────────────────────────────────
const FEEDBACK_TYPES: FeedbackType[] = ['Geral', 'Melhoria', 'Acerto', 'Urgente']

function feedbackTypeBadge(type: string | null | undefined) {
  if (!type || type === 'Geral') return null
  const map: Record<string, string> = {
    Melhoria: 'text-amber-400 bg-amber-400/10 border border-amber-400/20',
    Acerto: 'text-signal-green bg-signal-green/10 border border-signal-green/20',
    Urgente: 'text-signal-red bg-signal-red/10 border border-signal-red/20',
  }
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', map[type] ?? 'text-text-tertiary bg-white/5 border border-border')}>
      {type}
    </span>
  )
}

// ── Classification badge ──────────────────────────────────────────────────────
function ClassificationBadge({ result }: { result: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    qualificada: { label: 'Qualificada', cls: 'bg-signal-green/10 text-signal-green border-signal-green/20' },
    nao_qualificada: { label: 'Não qualificada', cls: 'bg-signal-red/10 text-signal-red border-signal-red/20' },
    parcialmente_qualificada: { label: 'Parcial', cls: 'bg-signal-amber/10 text-signal-amber border-signal-amber/20' },
  }
  const { label, cls } = map[result] ?? { label: result, cls: 'bg-white/5 text-text-secondary border-border' }
  return <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', cls)}>{label}</span>
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CallDetail() {
  const { callId } = useParams()
  const isUuid = !!callId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(callId)
  const navigate = useNavigate()
  const { call, loading } = useCall(callId)
  const { user } = useAuth()
  const { viewedRole } = useRole()
  const [tab, setTab] = useState<Tab>('briefer')
  const [feedback, setFeedback] = useState<CallFeedback[]>([])
  const [newComment, setNewComment] = useState('')
  const [newTimestamp, setNewTimestamp] = useState('')
  const [showSnippetModal, setShowSnippetModal] = useState(false)
  const [showFollowUpModal, setShowFollowUpModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('Geral')
  const [visibleToCloser, setVisibleToCloser] = useState(true)
  const [excerptText, setExcerptText] = useState('')

  useEffect(() => {
    if (!callId || !isUuid) return
    supabase
      .from('call_feedback').select('*').eq('call_id', callId).order('created_at')
      .then(({ data }) => setFeedback(data ?? []))
  }, [callId, isUuid])

  async function submitFeedback() {
    if (!newComment.trim() || !callId) return
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    const tsSeconds = newTimestamp.trim() ? parseInt(newTimestamp.trim(), 10) : null
    await supabase
      .from('call_feedback').insert({
        call_id: callId,
        coordinator_id: data.user.id,
        comment_text: newComment.trim(),
        transcript_position_s: !isNaN(tsSeconds as number) && tsSeconds !== null ? tsSeconds : null,
        feedback_type: feedbackType,
        visible_to_closer: visibleToCloser,
        transcript_excerpt: excerptText.trim() || null,
      })
    setNewComment(''); setNewTimestamp(''); setFeedbackType('Geral'); setVisibleToCloser(true); setExcerptText('')
    const { data: updated } = await supabase
      .from('call_feedback').select('*').eq('call_id', callId).order('created_at')
    setFeedback(updated ?? [])
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-text-tertiary text-sm">Carregando call...</div>
  }
  if (!call) {
    return <div className="flex items-center justify-center h-full text-text-tertiary text-sm">Call não encontrada.</div>
  }

  const analysis = call.analysis
  const scores = call.scores
  const richJson = analysis?.analysis_json   // full rich JSON from pipeline
  const callMeta = richJson?.call_metadata   // seller_name, prospect_name, call_date, duration_min

  // Derived display values — prefer rich JSON fields over raw call columns
  const sellerDisplay = callMeta?.seller_name ?? call.closer_email?.split('@')[0] ?? '—'
  const prospectDisplay = callMeta?.prospect_name ?? null
  const callDateDisplay = callMeta?.call_date ?? (call.happened_at ? call.happened_at.slice(0, 10) : null)
  const durationDisplay = callMeta?.duration_min
    ? `${callMeta.duration_min} min`
    : call.duration_seconds
      ? formatDuration(call.duration_seconds)
      : null

  // Determine if this is a valid sales call
  const isInvalidCall = (call.duration_seconds ?? 0) < 60 || (scores && scores.spiced_total === 0 && scores.spin_total === 0 && scores.challenger_total === 0 && !richJson?.spiced)

  type CriticalMoment = { text: string; timestamp_s?: number; type?: string }
  const criticalMoments = (analysis?.critical_moments ?? []) as CriticalMoment[]
  const objectionsCount = (analysis?.objections ?? []).length

  const tabItems: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
    { id: 'briefer', label: 'Diagnostico', icon: Zap },
    { id: 'trackers', label: 'Sinais', icon: TrendingUp },
    { id: 'methodology', label: 'Score', icon: Star },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'deal', label: 'Deal', icon: Briefcase },
    { id: 'similares', label: 'Similares', icon: Users },
  ]

  function fmt(n: number | null) {
    if (!n) return '—'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
  }

  // next_action — campo prescritivo gerado pelo pipeline analyze-call
  const nextAction = richJson?.next_action as {
    action: string; timing: string; main_argument: string
  } | undefined
  const ragEnrichedSummary = (analysis as { rag_enriched_summary?: string | null } | null)?.rag_enriched_summary ?? null

  // SPICED classification from rich JSON
  const spicedClassification = richJson?.spiced?.classification
  const spicedWeakDim = richJson?.spiced?.weak_dimension
  const dealNextSteps = richJson?.spiced?.deal_next_steps ?? []
  const decisionGaps = richJson?.spiced?.scores?.decision?.gaps ?? []

  return (
    <div className="flex flex-col h-full">
      {showSnippetModal && callId && (
        <CreateSnippetModal callId={callId} onClose={() => setShowSnippetModal(false)} onCreated={() => { }} />
      )}
      {showFollowUpModal && callId && (
        <FollowUpModal callId={callId} onClose={() => setShowFollowUpModal(false)} />
      )}

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-bg-card shrink-0">
        <button onClick={() => navigate('/calls')} className="btn-ghost -ml-1">
          <ChevronLeft size={16} /> Chamadas
        </button>

        <div className="flex-1 min-w-0">
          {/* Row 1: closer → prospect */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <User size={13} className="text-signal-blue shrink-0" />
              <h1 className="text-base font-semibold">{sellerDisplay}</h1>
            </div>
            {prospectDisplay && (
              <>
                <span className="text-text-tertiary text-sm">→</span>
                <span className="text-text-secondary text-sm font-medium">{prospectDisplay}</span>
              </>
            )}
            {spicedClassification?.result && <ClassificationBadge result={spicedClassification.result} />}
            {call.deal_stage && <span className="badge badge-blue">{call.deal_stage}</span>}
          </div>

          {/* Row 2: meta chips */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {callDateDisplay && (
              <span className="flex items-center gap-1 text-xs text-text-tertiary">
                <Calendar size={11} /> {callDateDisplay}
              </span>
            )}
            {durationDisplay && (
              <span className="flex items-center gap-1 text-xs text-text-tertiary">
                <Clock size={11} /> {durationDisplay}
              </span>
            )}
            {call.deal_acv && <span className="text-xs text-signal-amber font-semibold">{fmt(call.deal_acv)}</span>}
            {call.lead_perfil && <span className="text-xs text-text-tertiary">{call.lead_perfil}</span>}
            {call.lead_segmento && <span className="text-xs text-text-tertiary">{call.lead_segmento}</span>}
            {spicedWeakDim && (
              <span className="text-xs text-signal-red bg-signal-red/8 border border-signal-red/20 px-2 py-0.5 rounded-full">
                dim fraca: {spicedWeakDim}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ScoreRing score={scores?.spiced_total ?? null} size="md" showLabel />
          <button className="btn-outline" onClick={() => navigate('/roi-modeler')}>
            <TrendingUp size={14} /> ROI Modeler
          </button>
          <button className="btn-primary" onClick={() => setShowFollowUpModal(true)}>
            <Zap size={14} /> Gerar Follow-up
          </button>
          <button className="btn-outline" onClick={() => setShowSnippetModal(true)}>
            <Scissors size={14} /> Criar Snippet
          </button>
        </div>
      </div>

      {/* Invalid call banner */}
      {isInvalidCall && (
        <div className="mx-4 mt-3 mb-0 p-3 bg-signal-amber/8 border border-signal-amber/25 rounded-xl flex gap-2 items-start shrink-0">
          <AlertCircle size={14} className="text-signal-amber shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-signal-amber">Call sem análise de venda</p>
            <p className="text-xs text-text-tertiary mt-0.5">
              {analysis?.summary_text ?? 'Duração muito curta ou call sem conteúdo comercial para análise metodológica.'}
            </p>
          </div>
        </div>
      )}

      {(() => {
        const decision = buildCallDecision(richJson, scores)
        if (decision) {
          return (
            <DecisionBanner
              severity={decision.severity}
              status={decision.status}
              reason={decision.reason}
              action={decision.action}
              impact={decision.impact}
              cta={{
                label: 'Treinar equipe nesse gap',
                onClick: () => navigate(`/pdi/study/${call.closer_email ?? ''}`),
              }}
            />
          )
        }
        if (nextAction) return <NextActionCard nextAction={nextAction} />
        return null
      })()}

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — Interactive Transcript (60%) */}
        <div className="w-[60%] border-r border-border flex flex-col overflow-hidden">
          {(() => {
            // Build transcript segments from transcript_raw (JSONB) or fallback to critical_moments
            const transcriptRaw: Array<{ speaker: string; words: string; start_time?: number; end_time?: number }> =
              analysis?.transcript_raw ??
              (richJson?.transcript_raw as Array<{ speaker: string; words: string; start_time?: number; end_time?: number }> | undefined) ??
              (criticalMoments.length > 0
                ? criticalMoments.map((m, i) => ({
                  speaker: i % 2 === 0 ? 'Closer' : 'Cliente',
                  words: m.text,
                  start_time: m.timestamp_s ?? undefined,
                  end_time: undefined,
                }))
                : [])

            if (transcriptRaw.length === 0) {
              // No transcript available — show fallback
              return (
                <div className="flex-1 flex flex-col">
                  {analysis?.talk_ratio_seller != null ? (
                    <SpeakerTimeline
                      talkRatioSeller={analysis.talk_ratio_seller}
                      durationS={call.duration_seconds ?? null}
                      speakerSegments={
                        (analysis.speaker_segments ?? []).map((seg) => ({
                          speaker: (seg.speaker.toLowerCase() === 'closer' ? 'closer' : 'client') as 'closer' | 'client',
                          start_s: seg.start_s,
                          end_s: seg.end_s,
                        }))
                      }
                      longestMonologueS={analysis.longest_monologue_s ?? null}
                      questionsCount={analysis.questions_count ?? null}
                      objectionsCount={objectionsCount}
                    />
                  ) : (
                    <div className="px-4 py-3 border-b border-border/40">
                      <div className="flex items-center gap-4 text-xs text-text-tertiary">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-signal-blue" /><span>Closer</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-signal-green" /><span>Cliente</span></div>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto px-5 py-2">
                    {richJson?.spiced?.call_highlights?.length ? (
                      <div className="py-4 space-y-3">
                        <p className="section-eyebrow">Destaques da call</p>
                        {richJson.spiced.call_highlights.map((h: string, i: number) => (
                          <div key={i} className="flex gap-2 p-3 bg-bg-card2 rounded-xl">
                            <div className="w-1.5 h-1.5 rounded-full bg-signal-blue mt-1.5 shrink-0" />
                            <p className="text-sm text-text-secondary leading-relaxed">{h}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <AlertCircle size={20} className="text-text-tertiary mx-auto mb-2" />
                        <p className="text-text-tertiary text-sm">Transcricao ainda nao processada.</p>
                        {((call.tldv_call_id ?? call.tldv_meeting_id) || call.tldv_url) && (
                          <a
                            href={(call.tldv_call_id ?? call.tldv_meeting_id)
                              ? `https://tldv.io/app/meetings/${call.tldv_call_id ?? call.tldv_meeting_id}`
                              : call.tldv_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-3 text-xs text-signal-blue hover:underline"
                          >
                            <ExternalLink size={12} /> Ver no tl;dv
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            // Full interactive transcript
            return (
              <InteractiveTranscript
                callId={callId!}
                transcriptRaw={transcriptRaw}
                speakerSegments={
                  (analysis?.speaker_segments ?? []).map((seg) => ({
                    speaker: (seg.speaker.toLowerCase() === 'closer' ? 'closer' : 'client') as 'closer' | 'client',
                    start_s: seg.start_s,
                    end_s: seg.end_s,
                  }))
                }
                signals={{
                  objections: ((analysis?.objections ?? []) as Array<{ text: string; timestamp_s: number }>),
                  competitors: ((analysis?.competitors ?? []) as Array<{ name: string; timestamp_s: number; quote: string }>),
                  churnSignals: ((analysis?.churn_signals ?? []) as Array<{ text: string; timestamp_s: number }>),
                  buyIntentSignals: ((analysis?.buy_intent_signals ?? []) as Array<{ text: string; timestamp_s: number }>),
                  criticalMoments: (criticalMoments as Array<{ text: string; timestamp_s: number; type: string }>),
                }}
                feedback={feedback.map(f => ({
                  id: f.id,
                  transcript_position_s: f.transcript_position_s ?? 0,
                  comment_text: f.comment_text ?? '',
                  feedback_type: f.feedback_type ?? 'geral',
                  transcript_excerpt: f.transcript_excerpt ?? undefined,
                }))}
                durationSeconds={call.duration_seconds ?? 0}
                userRole={viewedRole as 'executivo' | 'coordenador' | 'admin'}
                userId={user?.id ?? ''}
                onFeedbackAdded={() => {
                  supabase
                    .from('call_feedback').select('*').eq('call_id', callId!).order('created_at')
                    .then(({ data }) => setFeedback(data ?? []))
                }}
              />
            )
          })()}
        </div>

        {/* RIGHT — AI Console (40%) */}
        <div className="w-[40%] flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-border shrink-0">
            {tabItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors',
                  tab === id ? 'text-text-primary border-b-2 border-g4-red' : 'text-text-tertiary hover:text-text-secondary border-b-2 border-transparent',
                )}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">

            {/* ── BRIEFER — Hierarquia 1-2-3-4 ── */}
            {tab === 'briefer' && (
              <div className="space-y-5">

                {/* ① O QUE ESTA ACONTECENDO */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-g4-red/15 text-g4-red text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Diagnostico rapido</p>
                  </div>
                  {analysis?.summary_text && (
                    <p className="text-sm text-text-secondary leading-relaxed">{analysis.summary_text}</p>
                  )}
                  {spicedClassification?.reason && (
                    <div className="p-3 bg-bg-card2 border border-border rounded-xl mt-2">
                      <p className="text-xs text-text-secondary leading-relaxed">{spicedClassification.reason}</p>
                    </div>
                  )}
                  {richJson?.consolidated && (
                    <div className={cn(
                      'p-3 rounded-xl space-y-1.5 border mt-2',
                      richJson.consolidated.deal_risk === 'alto'
                        ? 'bg-signal-red/6 border-signal-red/25'
                        : richJson.consolidated.deal_risk === 'medio'
                          ? 'bg-signal-amber/6 border-signal-amber/25'
                          : 'bg-signal-green/6 border-signal-green/25',
                    )}>
                      <p className={cn(
                        'text-[10px] font-bold uppercase tracking-widest',
                        richJson.consolidated.deal_risk === 'alto' ? 'text-signal-red'
                          : richJson.consolidated.deal_risk === 'medio' ? 'text-signal-amber'
                            : 'text-signal-green',
                      )}>
                        {richJson.consolidated.deal_risk === 'alto'
                          ? 'ALERTA DA IA — Deal em risco'
                          : richJson.consolidated.deal_risk === 'medio'
                            ? 'ATENCAO — Gaps que podem impactar fechamento'
                            : 'DEAL SAUDAVEL — Pipeline nos parametros'}
                      </p>
                      <p className="text-xs text-text-secondary leading-relaxed">{richJson.consolidated.cross_framework_insight}</p>
                    </div>
                  )}
                  {ragEnrichedSummary && (
                    <div className="p-3 bg-signal-blue/5 border border-signal-blue/20 rounded-xl mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-signal-blue mb-1">
                        Resumo RAG (transcrição)
                      </p>
                      <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                        {ragEnrichedSummary}
                      </p>
                    </div>
                  )}
                </div>

                {/* ② POR QUE ESTA ACONTECENDO */}
                {((analysis?.client_pains ?? []).length > 0 || spicedWeakDim) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 rounded-full bg-signal-amber/15 text-signal-amber text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Gaps que travam o deal</p>
                    </div>
                    {spicedWeakDim && (
                      <div className="flex items-center gap-2 mb-2 p-2.5 bg-signal-red/5 border border-signal-red/15 rounded-xl">
                        <AlertCircle size={13} className="text-signal-red shrink-0" />
                        <p className="text-xs text-text-secondary">Dimensao mais fraca: <span className="font-bold text-signal-red">{spicedWeakDim}</span></p>
                      </div>
                    )}
                    {(analysis?.client_pains ?? []).length > 0 && (
                      <div className="space-y-1.5">
                        {analysis!.client_pains!.map((p: { text: string }, i: number) => (
                          <div key={i} className="flex gap-2 p-2.5 bg-bg-card2 rounded-xl">
                            <div className="w-1.5 h-1.5 rounded-full bg-signal-red mt-1.5 shrink-0" />
                            <p className="text-xs text-text-secondary">{p.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ③ O QUE FAZER */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-signal-blue/15 text-signal-blue text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Acao imediata</p>
                  </div>
                  {dealNextSteps.length > 0 ? (
                    <div className="space-y-1.5">
                      {dealNextSteps.map((s: string, i: number) => (
                        <div key={i} className="flex gap-2 items-start p-2.5 bg-signal-blue/5 border border-signal-blue/15 rounded-xl">
                          <span className="text-signal-blue text-xs font-bold shrink-0 mt-0.5">{i + 1}.</span>
                          <p className="text-xs text-text-secondary leading-relaxed">{s}</p>
                        </div>
                      ))}
                    </div>
                  ) : (analysis?.next_steps ?? []).length > 0 ? (
                    <div className="space-y-1.5">
                      {analysis!.next_steps!.map((s: { text: string }, i: number) => (
                        <div key={i} className="flex gap-2 items-start p-2.5 bg-signal-blue/5 border border-signal-blue/15 rounded-xl">
                          <span className="text-signal-blue text-xs font-bold shrink-0 mt-0.5">{i + 1}.</span>
                          <p className="text-xs text-text-secondary leading-relaxed">{s.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-tertiary">Nenhuma acao identificada ainda.</p>
                  )}
                </div>

                {/* ④ EVIDENCIA (colapsavel) */}
                {((analysis?.buy_intent_signals ?? []).length > 0) && (
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer list-none mb-2">
                      <span className="w-5 h-5 rounded-full bg-signal-green/15 text-signal-green text-[10px] font-bold flex items-center justify-center shrink-0">4</span>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Sinais de fechamento</p>
                      <ChevronDown size={12} className="text-text-tertiary ml-auto group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="space-y-1.5">
                      {analysis!.buy_intent_signals!.map((s: { text: string }, i: number) => (
                        <div key={i} className="flex gap-2 p-2.5 bg-signal-green/5 border border-signal-green/15 rounded-lg">
                          <div className="w-1.5 h-1.5 rounded-full bg-signal-green mt-1.5 shrink-0" />
                          <p className="text-xs text-text-secondary">{s.text}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Navigation links */}
                {(call.deal_id || call.closer_email) && (
                  <div className="flex items-center gap-3 pt-2 border-t border-border/30">
                    {call.closer_email && (
                      <button
                        onClick={() => navigate(`/pdi/study/${call.closer_email}`)}
                        className="text-[10px] font-semibold text-g4-golden hover:underline flex items-center gap-1"
                      >
                        Treinar nesse gap →
                      </button>
                    )}
                    {call.deal_id && (
                      <button
                        onClick={() => navigate(`/insights?deal=${call.deal_id}`)}
                        className="text-[10px] font-semibold text-signal-blue hover:underline flex items-center gap-1"
                      >
                        Ver insight completo →
                      </button>
                    )}
                  </div>
                )}

                {!analysis && !richJson && (
                  <p className="text-text-tertiary text-sm">Analise ainda nao disponivel.</p>
                )}
              </div>
            )}

            {/* ── TRACKERS ── */}
            {tab === 'trackers' && (
              <div className="space-y-4">
                {/* Smart Trackers detected by AI */}
                {(analysis?.smart_trackers_detected ?? []).length > 0 && (
                  <div>
                    <p className="section-eyebrow mb-2">Smart Trackers Detectados</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis!.smart_trackers_detected!.map((tracker: string, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-g4-red/10 border border-g4-red/20 text-g4-red text-xs font-semibold rounded-full">
                          <Zap size={10} />
                          {tracker}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="section-eyebrow mb-2">Comportamento</p>
                  <div className="space-y-2 bg-bg-card2 rounded-xl p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Talk ratio closer</span>
                      <span className="font-semibold">{analysis?.talk_ratio_seller?.toFixed(0) ?? richJson?.behavior_signals?.talk_ratio_seller_pct?.toFixed(0) ?? '—'}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Maior monólogo</span>
                      <span className="font-semibold">{analysis?.longest_monologue_s ? `${analysis.longest_monologue_s}s` : '—'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Perguntas feitas</span>
                      <span className="font-semibold">{analysis?.questions_count ?? '—'}</span>
                    </div>
                    {richJson?.spin?.scores && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-text-secondary">Perguntas Situação</span>
                          <span className="font-semibold">{richJson.spin.question_map?.situation?.count ?? '—'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-text-secondary">Perguntas Implicação</span>
                          <span className={cn('font-semibold', (richJson.spin.question_map?.implication?.count ?? 0) === 0 ? 'text-signal-red' : '')}>
                            {richJson.spin.question_map?.implication?.count ?? 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-text-secondary">Pitch timing (min)</span>
                          <span className={cn('font-semibold', (richJson.spin.sequence_analysis?.pitch_timing?.estimated_pitch_minute ?? 99) <= 5 ? 'text-signal-red' : 'text-text-primary')}>
                            {richJson.spin.sequence_analysis?.pitch_timing?.estimated_pitch_minute != null
                              ? `min ${richJson.spin.sequence_analysis.pitch_timing.estimated_pitch_minute}`
                              : '—'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Secondary sections collapsed by default */}
                {(analysis?.competitors ?? []).length > 0 && (
                  <details className="group">
                    <summary className="section-eyebrow mb-2 cursor-pointer list-none flex items-center gap-1">
                      Concorrentes mencionados ({analysis!.competitors!.length})
                      <ChevronDown size={10} className="text-text-tertiary ml-1 group-open:rotate-180 transition-transform" />
                    </summary>
                    {analysis!.competitors!.map((c: { name: string; quote?: string }, i: number) => (
                      <div key={i} className="p-3 bg-bg-card2 rounded-xl mb-2">
                        <span className="text-sm font-semibold text-signal-amber">{c.name}</span>
                        {c.quote && <p className="text-xs text-text-tertiary mt-1">"{c.quote}"</p>}
                      </div>
                    ))}
                  </details>
                )}

                {objectionsCount > 0 && (
                  <details className="group">
                    <summary className="section-eyebrow mb-2 cursor-pointer list-none flex items-center gap-1">
                      Objecoes detectadas ({objectionsCount})
                      <ChevronDown size={10} className="text-text-tertiary ml-1 group-open:rotate-180 transition-transform" />
                    </summary>
                    {analysis!.objections!.map((o: { text: string }, i: number) => (
                      <div key={i} className="p-3 bg-signal-red/5 border border-signal-red/15 rounded-xl mb-2">
                        <p className="text-sm text-text-secondary">{o.text}</p>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            )}

            {/* ── METHODOLOGY ── */}
            {tab === 'methodology' && (
              <div className="space-y-4">
                <MethodologyScoresPanel scores={scores} richJson={richJson} />

                {/* Coordinator override */}
                {scores && (
                  <OverrideForm
                    scoresId={scores.id}
                    initial={typeof scores.coordinator_override === 'number' ? scores.coordinator_override : null}
                    note={typeof scores.override_note === 'string' ? scores.override_note : null}
                  />
                )}
              </div>
            )}

            {/* ── FEEDBACK ── */}
            {tab === 'feedback' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  {feedback.length === 0 && <p className="text-text-tertiary text-sm">Nenhum feedback ainda.</p>}
                  {feedback.map(f => (
                    <div key={f.id} className="p-3 bg-bg-card2 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        {f.transcript_position_s != null && (
                          <span className="text-xs text-signal-blue font-mono">{f.transcript_position_s}s</span>
                        )}
                        {feedbackTypeBadge(f.feedback_type)}
                      </div>
                      <p className="text-sm text-text-secondary">{f.comment_text}</p>
                      {f.transcript_excerpt && (
                        <p className="text-xs text-text-tertiary mt-1.5 italic border-l-2 border-border pl-2">{f.transcript_excerpt}</p>
                      )}
                      <p className="text-xs text-text-tertiary mt-1">
                        {new Date(f.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input type="number" value={newTimestamp} onChange={e => setNewTimestamp(e.target.value)}
                      placeholder="Seg (ex: 120)" min={0}
                      className="w-28 shrink-0 bg-bg-card2 border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
                    />
                    <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                      placeholder="Adicionar comentário..."
                      onKeyDown={e => e.key === 'Enter' && submitFeedback()}
                      className="flex-1 bg-bg-card2 border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-tertiary mb-1 block">Tipo</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {FEEDBACK_TYPES.map(ft => {
                        const colorMap: Record<FeedbackType, string> = {
                          Geral: 'bg-bg-card2 border border-border text-text-secondary',
                          Melhoria: 'bg-amber-400/10 border border-amber-400/30 text-amber-400',
                          Acerto: 'bg-signal-green/10 border border-signal-green/30 text-signal-green',
                          Urgente: 'bg-signal-red/10 border border-signal-red/30 text-signal-red',
                        }
                        const activeMap: Record<FeedbackType, string> = {
                          Geral: 'ring-1 ring-border-light',
                          Melhoria: 'ring-1 ring-amber-400',
                          Acerto: 'ring-1 ring-signal-green',
                          Urgente: 'ring-1 ring-signal-red',
                        }
                        return (
                          <button key={ft} onClick={() => setFeedbackType(ft)}
                            className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold transition-all', colorMap[ft], feedbackType === ft && activeMap[ft])}>
                            {ft}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Visível para o closer</span>
                    <button onClick={() => setVisibleToCloser(v => !v)}
                      className={cn('relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                        visibleToCloser ? 'bg-signal-blue' : 'bg-bg-elevated')}>
                      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                        visibleToCloser ? 'translate-x-4' : 'translate-x-0')} />
                    </button>
                  </div>
                  <div>
                    <label className="text-xs text-text-tertiary mb-1 block">Trecho relevante (opcional)</label>
                    <textarea value={excerptText} onChange={e => setExcerptText(e.target.value)}
                      placeholder="Cole aqui o trecho do transcript que embasa o feedback…" rows={2}
                      className="w-full bg-bg-card2 border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid resize-none"
                    />
                  </div>
                  <button onClick={() => setShowFeedbackModal(true)} className="btn-primary w-full justify-center">
                    <MessageSquare size={14} /> Adicionar Feedback
                  </button>
                  <p className="text-[10px] text-text-tertiary">Timestamp opcional — segundos a partir do início da call</p>
                </div>
              </div>
            )}

            {/* ── DEAL ── */}
            {tab === 'deal' && (
              <div className="space-y-4">
                <div className="bg-bg-card2 border border-border rounded-xl p-4 space-y-4">
                  <p className="section-eyebrow">Informações do Deal</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Deal ID</p>
                      {call.deal_id
                        ? <span className="font-mono text-xs bg-bg-elevated border border-border px-2 py-0.5 rounded text-text-secondary">{call.deal_id}</span>
                        : <span className="text-text-tertiary text-xs">—</span>}
                    </div>
                    <div>
                      <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">ACV</p>
                      <p className={cn('text-lg font-bold', call.deal_acv ? 'text-signal-amber' : 'text-text-tertiary')}>
                        {call.deal_acv ? fmt(call.deal_acv) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Estágio</p>
                      {call.deal_stage
                        ? <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                          call.deal_stage.toLowerCase().includes('proposta') ? 'bg-signal-blue/10 text-signal-blue border border-signal-blue/20' :
                            call.deal_stage.toLowerCase().includes('negoci') ? 'bg-signal-amber/10 text-signal-amber border-signal-amber/20' :
                              call.deal_stage.toLowerCase().includes('fecha') ? 'bg-signal-green/10 text-signal-green border-signal-green/20' :
                                'bg-bg-elevated text-text-secondary border border-border'
                        )}>{call.deal_stage}</span>
                        : <span className="text-text-tertiary text-xs">—</span>}
                    </div>
                    <div>
                      <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Status deal</p>
                      <p className="text-sm text-text-secondary">{call.deal_status ?? '—'}</p>
                    </div>
                  </div>
                  {call.lead_perfil && (
                    <div>
                      <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Perfil do Lead</p>
                      <p className="text-sm text-text-secondary">{call.lead_perfil}</p>
                    </div>
                  )}
                  {call.lead_segmento && (
                    <div>
                      <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Segmento</p>
                      <p className="text-sm text-text-secondary">{call.lead_segmento}</p>
                    </div>
                  )}
                  {callMeta && (
                    <div>
                      <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Prospect</p>
                      <p className="text-sm text-text-secondary">{callMeta.prospect_name}</p>
                    </div>
                  )}
                </div>

                {/* Buying center info from rich JSON */}
                {richJson?.spiced?.scores?.decision && (
                  <div className="p-3 bg-bg-card2 border border-border rounded-xl">
                    <p className="section-eyebrow mb-2">Processo de Decisão</p>
                    <div className="space-y-1.5 text-xs text-text-secondary">
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Papel do prospect</span>
                        <span className="font-semibold capitalize">{richJson.spiced.scores.decision.prospect_role ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Buying center mapeado</span>
                        <span className={cn('font-semibold', richJson.spiced.scores.decision.buying_center_mapped ? 'text-signal-green' : 'text-signal-red')}>
                          {richJson.spiced.scores.decision.buying_center_mapped ? 'Sim' : 'Não'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Critérios identificados</span>
                        <span className={cn('font-semibold', richJson.spiced.scores.decision.criteria_identified ? 'text-signal-green' : 'text-signal-red')}>
                          {richJson.spiced.scores.decision.criteria_identified ? 'Sim' : 'Não'}
                        </span>
                      </div>
                    </div>
                    {decisionGaps.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1.5">Gaps</p>
                        <div className="space-y-1">
                          {decisionGaps.map((g: string, i: number) => (
                            <p key={i} className="text-[11px] text-text-tertiary">• {g}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <p className="section-eyebrow mb-2">Competidores mencionados</p>
                  {(analysis?.competitors ?? []).length > 0
                    ? <div className="flex flex-wrap gap-2">
                      {analysis!.competitors!.map((c: { name: string }, i: number) => (
                        <span key={i} className="bg-white/5 border border-border rounded-full px-3 py-1 text-xs text-text-secondary">{c.name}</span>
                      ))}
                    </div>
                    : <p className="text-text-tertiary text-xs">Nenhum competidor mencionado</p>}
                </div>

                {(analysis?.buy_intent_signals ?? []).length > 0 && (
                  <div>
                    <p className="section-eyebrow mb-2">Sinais de compra</p>
                    <div className="space-y-1.5">
                      {analysis!.buy_intent_signals!.map((s: { text: string }, i: number) => (
                        <div key={i} className="flex gap-2 items-start">
                          <CheckCircle2 size={13} className="text-signal-green shrink-0 mt-0.5" />
                          <p className="text-xs text-text-secondary">{s.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SIMILARES ── */}
            {tab === 'similares' && (
              <div className="space-y-4">
                <div>
                  <p className="section-eyebrow mb-1">Clientes com perfil similar</p>
                  <p className="text-xs text-text-tertiary leading-relaxed">
                    Deals do historico com ACV e score SPICED proximos ao prospect atual.
                    Use como social proof durante a negociacao.
                  </p>
                </div>
                <SegmentationChart
                  currentCallId={callId ?? ''}
                  currentAcv={call.deal_acv ?? null}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showFeedbackModal && callId && (
        <CallFeedbackModal
          callId={callId}
          callTitle={`${sellerDisplay} → ${prospectDisplay ?? call.deal_id ?? 'N/A'}`}
          onClose={() => setShowFeedbackModal(false)}
          onFeedbackAdded={() => {
            supabase
              .from('call_feedback').select('*').eq('call_id', callId).order('created_at')
              .then(({ data }) => setFeedback(data ?? []))
          }}
        />
      )}
    </div>
  )
}
