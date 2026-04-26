import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { MessageSquare, Scissors, Search, X, Check } from 'lucide-react'
import { cn } from '../lib/cn'
import { supabase } from '../lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

interface TranscriptSegment {
  speaker: string
  words: string
  start_time?: number
  end_time?: number
}

interface SignalItem { text: string; timestamp_s: number }
interface CompetitorSignal { name: string; timestamp_s: number; quote: string }
interface CriticalMoment { text: string; timestamp_s: number; type: string }

interface FeedbackItem {
  id: string
  transcript_position_s: number
  comment_text: string
  feedback_type: string
  transcript_excerpt?: string
}

export interface InteractiveTranscriptProps {
  callId: string
  transcriptRaw: TranscriptSegment[]
  speakerSegments?: Array<{ speaker: string; start_s: number; end_s: number }>
  signals: {
    objections: SignalItem[]
    competitors: CompetitorSignal[]
    churnSignals: SignalItem[]
    buyIntentSignals: SignalItem[]
    criticalMoments: CriticalMoment[]
  }
  feedback: FeedbackItem[]
  durationSeconds: number
  userRole: 'executivo' | 'coordenador' | 'admin'
  userId: string
  onFeedbackAdded?: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(s: number | undefined): string {
  if (s == null) return '--:--'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function isSeller(speaker: string): boolean {
  const s = speaker.toLowerCase()
  return s.includes('closer') || s.includes('seller') || s.includes('vendedor') || s.includes('rep')
}

const SNIPPET_TAGS = ['objecao', 'spin', 'spiced', 'challenger', 'exemplo'] as const
const FEEDBACK_TYPES = ['melhoria', 'acerto', 'urgente', 'geral'] as const

const FEEDBACK_COLORS: Record<string, string> = {
  melhoria: 'border-l-amber-400 bg-amber-400/5',
  acerto: 'border-l-green-400 bg-green-400/5',
  urgente: 'border-l-red-400 bg-red-400/5',
  geral: 'border-l-blue-400 bg-blue-400/5',
}

const FEEDBACK_BADGE: Record<string, string> = {
  melhoria: 'text-amber-400 bg-amber-400/10',
  acerto: 'text-green-400 bg-green-400/10',
  urgente: 'text-red-400 bg-red-400/10',
  geral: 'text-blue-400 bg-blue-400/10',
}

// ── Create Snippet Modal ─────────────────────────────────────────────────────

function SnippetModal({
  callId, userId, excerpt, startSec, endSec, onClose, onCreated,
}: {
  callId: string; userId: string; excerpt: string; startSec?: number; endSec?: number
  onClose: () => void; onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [tag, setTag] = useState<string>('objecao')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    await supabase
      .from('snippets').insert({
        call_id: callId,
        title: title.trim(),
        tag,
        transcript_excerpt: excerpt,
        start_second: startSec ?? null,
        end_second: endSec ?? null,
        is_public: isPublic,
        created_by: userId,
      })
    setSaving(false)
    setDone(true)
    setTimeout(() => { onCreated(); onClose() }, 800)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Criar Snippet</h2>
            <p className="text-xs text-text-tertiary mt-0.5">Salvar trecho selecionado</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={14} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-text-tertiary mb-1 block">Trecho selecionado</label>
            <div className="bg-bg-card2 border border-border rounded-xl px-3 py-2 text-xs text-text-secondary max-h-24 overflow-y-auto font-mono leading-relaxed">
              {excerpt}
            </div>
            {startSec != null && (
              <p className="text-[10px] text-text-tertiary mt-1">
                {fmtTime(startSec)}{endSec != null ? ` - ${fmtTime(endSec)}` : ''}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-text-tertiary mb-1 block">Titulo</label>
            <input
              autoFocus type="text"
              placeholder="Ex: Contorno de objecao de preco"
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
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border accent-g4-red" />
            <span className="text-xs text-text-secondary">Visivel para todo o time</span>
          </label>
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button onClick={save} disabled={saving || done || !title.trim()}
            className={cn('btn-primary flex-1 justify-center disabled:opacity-50', done && 'bg-signal-green border-signal-green')}>
            {done ? <><Check size={14} /> Salvo!</> : saving ? 'Salvando...' : <><Scissors size={14} /> Salvar</>}
          </button>
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── Feedback Form (inline) ───────────────────────────────────────────────────

function FeedbackForm({
  callId, userId, segment, onClose, onCreated,
}: {
  callId: string; userId: string
  segment: TranscriptSegment
  onClose: () => void; onCreated: () => void
}) {
  const [comment, setComment] = useState('')
  const [feedbackType, setFeedbackType] = useState<string>('geral')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!comment.trim()) return
    setSaving(true)
    await supabase
      .from('call_feedback').insert({
        call_id: callId,
        coordinator_id: userId,
        comment_text: comment.trim(),
        transcript_position_s: segment.start_time != null ? Math.round(segment.start_time) : null,
        feedback_type: feedbackType,
        transcript_excerpt: segment.words.slice(0, 300),
        visible_to_closer: true,
      })
    setSaving(false)
    onCreated()
    onClose()
  }

  return (
    <div className="mt-2 p-3 bg-bg-card2 border border-border rounded-xl space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-secondary">Adicionar Feedback</span>
        <button onClick={onClose} className="btn-ghost p-1"><X size={12} /></button>
      </div>
      <textarea
        autoFocus
        value={comment} onChange={e => setComment(e.target.value)}
        placeholder="Escreva seu comentario..."
        rows={2}
        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid resize-none"
      />
      <div className="flex gap-1.5 flex-wrap">
        {FEEDBACK_TYPES.map(ft => (
          <button key={ft} onClick={() => setFeedbackType(ft)}
            className={cn(
              'px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all capitalize',
              feedbackType === ft
                ? FEEDBACK_BADGE[ft] + ' ring-1 ring-current'
                : 'bg-bg-elevated text-text-tertiary hover:text-text-secondary'
            )}>
            {ft}
          </button>
        ))}
      </div>
      <button onClick={save} disabled={saving || !comment.trim()}
        className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
        <MessageSquare size={12} /> {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  )
}

// ── Floating Toolbar ─────────────────────────────────────────────────────────

function FloatingToolbar({
  position, onCreateSnippet, onDismiss,
}: {
  position: { x: number; y: number }
  onCreateSnippet: () => void
  onDismiss: () => void
}) {
  return (
    <div
      className="fixed z-40 bg-bg-card border border-border rounded-xl shadow-2xl py-1.5 px-2 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150"
      style={{ left: position.x, top: position.y - 44 }}
    >
      <button
        onClick={onCreateSnippet}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-text-primary hover:bg-bg-elevated transition-colors"
      >
        <Scissors size={13} className="text-g4-red" /> Criar Snippet
      </button>
      <button onClick={onDismiss} className="p-1 rounded-md hover:bg-bg-elevated text-text-tertiary">
        <X size={12} />
      </button>
    </div>
  )
}

// ── Highlight text helper ────────────────────────────────────────────────────

function HighlightedText({ text, searchTerm }: { text: string; searchTerm: string }) {
  if (!searchTerm.trim()) return <>{text}</>
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-signal-amber/30 text-text-primary rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function InteractiveTranscript({
  callId,
  transcriptRaw,
  speakerSegments,
  signals,
  feedback,
  durationSeconds,
  userRole,
  userId,
  onFeedbackAdded,
}: InteractiveTranscriptProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [snippetModal, setSnippetModal] = useState<{
    excerpt: string; startSec?: number; endSec?: number
  } | null>(null)
  const [floatingToolbar, setFloatingToolbar] = useState<{
    x: number; y: number; excerpt: string; startSec?: number; endSec?: number
  } | null>(null)
  const [feedbackSegmentIdx, setFeedbackSegmentIdx] = useState<number | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const canAddFeedback = userRole === 'coordenador' || userRole === 'admin'
  const duration = durationSeconds > 0 ? durationSeconds : 1

  // Build a lookup: timestamp_s => feedback items
  const feedbackByTime = useMemo(() => {
    const map = new Map<number, FeedbackItem[]>()
    for (const fb of feedback) {
      const t = fb.transcript_position_s
      const arr = map.get(t) ?? []
      arr.push(fb)
      map.set(t, arr)
    }
    return map
  }, [feedback])

  // Build set of signal timestamps for highlighting segments
  const signalTimestamps = useMemo(() => {
    const map = new Map<number, string>() // rounded start_time => color class
    for (const o of signals.objections) map.set(Math.round(o.timestamp_s), 'bg-red-500/8')
    for (const c of signals.competitors) map.set(Math.round(c.timestamp_s), 'bg-orange-500/8')
    for (const s of signals.churnSignals) map.set(Math.round(s.timestamp_s), 'bg-yellow-500/8')
    for (const b of signals.buyIntentSignals) map.set(Math.round(b.timestamp_s), 'bg-green-500/8')
    for (const m of signals.criticalMoments) map.set(Math.round(m.timestamp_s), 'bg-purple-500/8')
    return map
  }, [signals])

  // Find closest segment index for a given timestamp
  const findSegmentIndex = useCallback((ts: number) => {
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < transcriptRaw.length; i++) {
      const seg = transcriptRaw[i]
      const d = Math.abs((seg.start_time ?? 0) - ts)
      if (d < bestDist) { bestDist = d; best = i }
    }
    return best
  }, [transcriptRaw])

  // Scroll to segment
  const scrollToSegment = useCallback((idx: number) => {
    const el = segmentRefs.current.get(idx)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-1', 'ring-signal-blue/50')
      setTimeout(() => el.classList.remove('ring-1', 'ring-signal-blue/50'), 2000)
    }
  }, [])

  const scrollToTime = useCallback((ts: number) => {
    scrollToSegment(findSegmentIndex(ts))
  }, [findSegmentIndex, scrollToSegment])

  // Handle text selection for snippet creation
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return
    }
    const text = selection.toString().trim()
    if (text.length < 5) return

    // Find the segment that contains the selection start
    const anchorNode = selection.anchorNode
    let segEl: HTMLElement | null = anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement ?? null
    while (segEl && !segEl.dataset.segIdx) {
      segEl = segEl.parentElement
    }
    const segIdx = segEl?.dataset.segIdx != null ? parseInt(segEl.dataset.segIdx) : undefined
    const seg = segIdx != null ? transcriptRaw[segIdx] : undefined

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    setFloatingToolbar({
      x: Math.min(rect.left + rect.width / 2 - 70, window.innerWidth - 200),
      y: rect.top + window.scrollY,
      excerpt: text,
      startSec: seg?.start_time,
      endSec: seg?.end_time,
    })
  }, [transcriptRaw])

  // Dismiss floating toolbar on outside click
  useEffect(() => {
    function handleClick() {
      // Small delay to allow the toolbar button click to register
      setTimeout(() => {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed) {
          setFloatingToolbar(null)
        }
      }, 100)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Filter transcript segments when searching
  const visibleSegments = useMemo(() => {
    if (!searchTerm.trim()) return transcriptRaw.map((seg, i) => ({ seg, idx: i }))
    const lc = searchTerm.toLowerCase()
    return transcriptRaw
      .map((seg, i) => ({ seg, idx: i }))
      .filter(({ seg }) => seg.words.toLowerCase().includes(lc))
  }, [transcriptRaw, searchTerm])

  // Find feedback that matches a segment's timestamp
  function getFeedbackForSegment(seg: TranscriptSegment): FeedbackItem[] {
    if (seg.start_time == null) return []
    const t = Math.round(seg.start_time)
    // Check a small window around the timestamp
    const items: FeedbackItem[] = []
    for (let delta = -2; delta <= 2; delta++) {
      const fb = feedbackByTime.get(t + delta)
      if (fb) items.push(...fb)
    }
    return items
  }

  // Get signal highlight for a segment
  function getSignalHighlight(seg: TranscriptSegment): string | undefined {
    if (seg.start_time == null) return undefined
    const t = Math.round(seg.start_time)
    for (let delta = -3; delta <= 3; delta++) {
      const hl = signalTimestamps.get(t + delta)
      if (hl) return hl
    }
    return undefined
  }

  // ── All signal pins for the timeline ───────────────────────────────────────
  const allPins = useMemo(() => {
    const pins: Array<{ position: number; color: string; title: string; ts: number }> = []
    for (const o of signals.objections)
      pins.push({ position: (o.timestamp_s / duration) * 100, color: 'bg-red-500', title: `Objecao: ${o.text.slice(0, 60)}`, ts: o.timestamp_s })
    for (const c of signals.competitors)
      pins.push({ position: (c.timestamp_s / duration) * 100, color: 'bg-orange-500', title: `Concorrente: ${c.name}`, ts: c.timestamp_s })
    for (const s of signals.churnSignals)
      pins.push({ position: (s.timestamp_s / duration) * 100, color: 'bg-yellow-500', title: `Churn: ${s.text.slice(0, 60)}`, ts: s.timestamp_s })
    for (const b of signals.buyIntentSignals)
      pins.push({ position: (b.timestamp_s / duration) * 100, color: 'bg-green-500', title: `Compra: ${b.text.slice(0, 60)}`, ts: b.timestamp_s })
    for (const m of signals.criticalMoments)
      pins.push({ position: (m.timestamp_s / duration) * 100, color: 'bg-purple-500', title: `Momento: ${m.text.slice(0, 60)}`, ts: m.timestamp_s })
    return pins
  }, [signals, duration])

  const feedbackPins = useMemo(() => {
    return feedback
      .filter(f => f.transcript_position_s != null)
      .map(f => ({
        position: (f.transcript_position_s / duration) * 100,
        ts: f.transcript_position_s,
        type: f.feedback_type,
      }))
  }, [feedback, duration])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Timeline bar ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Timeline</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(v => !v)}
              className={cn('p-1.5 rounded-lg transition-colors', showSearch ? 'bg-bg-elevated text-text-primary' : 'text-text-tertiary hover:text-text-secondary')}>
              <Search size={13} />
            </button>
            <span className="text-[10px] text-text-tertiary font-mono">{fmtTime(0)} — {fmtTime(durationSeconds)}</span>
          </div>
        </div>

        {/* Speaker segments bar */}
        <div className="relative h-6 bg-white/5 rounded-full overflow-visible">
          {speakerSegments && speakerSegments.length > 0 ? (
            speakerSegments.map((seg, i) => (
              <div key={i}
                className={cn(
                  'absolute top-0 h-full rounded-sm',
                  isSeller(seg.speaker) ? 'bg-signal-blue/60' : 'bg-signal-green/60'
                )}
                style={{
                  left: `${(seg.start_s / duration) * 100}%`,
                  width: `${Math.max(((seg.end_s - seg.start_s) / duration) * 100, 0.3)}%`,
                }}
              />
            ))
          ) : (
            <div className="w-full h-full rounded-full bg-white/5" />
          )}

          {/* Signal pins */}
          {allPins.map((pin, i) => (
            <div key={`sig-${i}`}
              className={cn('absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full cursor-pointer z-10 ring-1 ring-black/30 hover:scale-150 transition-transform', pin.color)}
              style={{ left: `${Math.min(Math.max(pin.position, 1), 99)}%` }}
              title={pin.title}
              onClick={() => scrollToTime(pin.ts)}
            />
          ))}

          {/* Feedback pins */}
          {feedbackPins.map((pin, i) => (
            <div key={`fb-${i}`}
              className="absolute -bottom-1 w-2 h-2 rounded-full bg-signal-blue border border-bg-base cursor-pointer z-10 hover:scale-150 transition-transform"
              style={{ left: `${Math.min(Math.max(pin.position, 1), 99)}%` }}
              title={`Feedback (${pin.type})`}
              onClick={() => scrollToTime(pin.ts)}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-text-tertiary flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-signal-blue inline-block" /> Closer</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-signal-green inline-block" /> Cliente</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" /> Objecao</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" /> Concorrente</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Compra</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" /> Momento</span>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              autoFocus
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar na transcricao..."
              className="w-full bg-bg-card2 border border-border rounded-xl pl-8 pr-8 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary">
                <X size={12} />
              </button>
            )}
            {searchTerm && (
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-text-tertiary">
                {visibleSegments.length} resultado{visibleSegments.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Transcript body ───────────────────────────────────────────────── */}
      <div
        ref={transcriptRef}
        className="flex-1 overflow-y-auto px-4 py-2"
        onMouseUp={handleMouseUp}
      >
        {visibleSegments.length === 0 ? (
          <div className="py-8 text-center text-text-tertiary text-sm">
            {searchTerm ? 'Nenhum resultado encontrado.' : 'Transcricao nao disponivel.'}
          </div>
        ) : (
          visibleSegments.map(({ seg, idx }) => {
            const seller = isSeller(seg.speaker)
            const highlight = getSignalHighlight(seg)
            const segFeedback = getFeedbackForSegment(seg)
            const showFeedbackForm = feedbackSegmentIdx === idx

            return (
              <div
                key={idx}
                ref={el => { if (el) segmentRefs.current.set(idx, el) }}
                data-seg-idx={idx}
                className={cn(
                  'group relative py-2.5 px-3 rounded-lg mb-1 transition-colors',
                  highlight,
                  seller ? 'mr-8' : 'ml-8',
                  !highlight && 'hover:bg-white/[0.02]',
                )}
              >
                {/* Timestamp + speaker label */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-text-tertiary w-10 shrink-0">
                    {fmtTime(seg.start_time)}
                  </span>
                  <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', seller ? 'bg-signal-blue' : 'bg-signal-green')} />
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider', seller ? 'text-signal-blue' : 'text-signal-green')}>
                    {seg.speaker}
                  </span>

                  {/* Add feedback button (on hover, for coordinators) */}
                  {canAddFeedback && (
                    <button
                      onClick={() => setFeedbackSegmentIdx(showFeedbackForm ? null : idx)}
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-bg-elevated text-text-tertiary hover:text-text-secondary"
                      title="Adicionar feedback"
                    >
                      <MessageSquare size={12} />
                    </button>
                  )}
                </div>

                {/* Transcript text */}
                <div className="pl-12 text-sm text-text-secondary leading-relaxed select-text">
                  <HighlightedText text={seg.words} searchTerm={searchTerm} />
                </div>

                {/* Inline feedback annotations */}
                {segFeedback.length > 0 && (
                  <div className="pl-12 mt-2 space-y-1.5">
                    {segFeedback.map(fb => (
                      <div key={fb.id} className={cn('border-l-2 pl-2.5 py-1.5 rounded-r-lg text-xs', FEEDBACK_COLORS[fb.feedback_type] ?? FEEDBACK_COLORS.geral)}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <MessageSquare size={10} className="text-text-tertiary" />
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize', FEEDBACK_BADGE[fb.feedback_type] ?? FEEDBACK_BADGE.geral)}>
                            {fb.feedback_type}
                          </span>
                        </div>
                        <p className="text-text-secondary">{fb.comment_text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Feedback form */}
                {showFeedbackForm && (
                  <div className="pl-12">
                    <FeedbackForm
                      callId={callId}
                      userId={userId}
                      segment={seg}
                      onClose={() => setFeedbackSegmentIdx(null)}
                      onCreated={() => {
                        setFeedbackSegmentIdx(null)
                        onFeedbackAdded?.()
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── Floating toolbar (text selection) ─────────────────────────────── */}
      {floatingToolbar && (
        <FloatingToolbar
          position={{ x: floatingToolbar.x, y: floatingToolbar.y }}
          onCreateSnippet={() => {
            setSnippetModal({
              excerpt: floatingToolbar.excerpt,
              startSec: floatingToolbar.startSec,
              endSec: floatingToolbar.endSec,
            })
            setFloatingToolbar(null)
            window.getSelection()?.removeAllRanges()
          }}
          onDismiss={() => {
            setFloatingToolbar(null)
            window.getSelection()?.removeAllRanges()
          }}
        />
      )}

      {/* ── Snippet modal ─────────────────────────────────────────────────── */}
      {snippetModal && (
        <SnippetModal
          callId={callId}
          userId={userId}
          excerpt={snippetModal.excerpt}
          startSec={snippetModal.startSec}
          endSec={snippetModal.endSec}
          onClose={() => setSnippetModal(null)}
          onCreated={() => setSnippetModal(null)}
        />
      )}
    </div>
  )
}
