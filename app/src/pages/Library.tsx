import { useState, useEffect, useRef } from 'react'
import { Play, BookOpen, Star, Sparkles, Send, X, Check, ShieldCheck, Plus, ExternalLink, Clock, Tag } from 'lucide-react'
import { useCloserList } from '../hooks/useCalls'
import { useRole } from '../contexts/RoleContext'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { Snippet, MethodologyScores } from '../types/database'
import { buildSnippetInsertPayload, buildTldvLink } from '../features/game-film/utils'

const TAGS = ['Todos', 'objecao', 'spin', 'spiced', 'challenger', 'exemplo']
const TAG_LABELS: Record<string, string> = {
  'Todos': 'Todos',
  'objecao': 'Objeção',
  'spin': 'SPIN',
  'spiced': 'SPICED',
  'challenger': 'Challenger',
  'exemplo': 'Exemplo',
}

// ─── Snippet Detail Modal ────────────────────────────────────────────────────

function formatSeconds(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

interface VideoPlayerModalProps {
  snippet: SnippetWithCall
  onClose: () => void
}

function VideoPlayerModal({ snippet, onClose }: VideoPlayerModalProps) {
  const meetingId = snippet.calls?.tldv_call_id
  const tldvUrl = snippet.calls?.tldv_url
  const tldvLink = buildTldvLink({ tldv_call_id: meetingId, tldv_url: tldvUrl }, snippet.start_second ?? null)

  const hasTimestamp = snippet.start_second != null && snippet.end_second != null
  const duration = hasTimestamp ? snippet.end_second! - snippet.start_second! : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-border">
          <div className="flex-1 min-w-0">
            {snippet.tag && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-g4-golden mb-1.5">
                <Tag size={9} />
                {TAG_LABELS[snippet.tag] ?? snippet.tag}
              </span>
            )}
            <h2 className="text-base font-bold text-text-primary leading-snug">{snippet.title}</h2>
            {hasTimestamp && (
              <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1 text-xs text-text-tertiary font-mono">
                  <Clock size={10} />
                  {formatSeconds(snippet.start_second!)} — {formatSeconds(snippet.end_second!)}
                </span>
                {duration != null && (
                  <span className="text-[10px] text-text-tertiary bg-bg-elevated px-2 py-0.5 rounded-full">
                    {duration}s de trecho
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:bg-bg-elevated hover:text-text-primary transition-all shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Transcript excerpt */}
          {snippet.transcript_excerpt && (
            <div className="bg-bg-elevated rounded-xl p-4 border border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2">Trecho da Call</p>
              <p className="text-sm text-text-secondary leading-relaxed">{snippet.transcript_excerpt}</p>
            </div>
          )}

          {/* CTA */}
          {tldvLink ? (
            <a
              href={tldvLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 w-full px-4 py-3.5 bg-g4-golden text-g4-navy rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-g4-navy/15 flex items-center justify-center shrink-0">
                  <Play size={13} fill="currentColor" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold">Assistir no tl;dv</div>
                  {hasTimestamp && (
                    <div className="text-[10px] opacity-70 font-normal">
                      Abre direto em {formatSeconds(snippet.start_second!)}
                    </div>
                  )}
                </div>
              </div>
              <ExternalLink size={14} className="opacity-60 group-hover:opacity-100 transition-opacity" />
            </a>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-bg-elevated border border-border rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-signal-amber/10 flex items-center justify-center shrink-0">
                <Play size={14} className="text-signal-amber" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Sem gravação vinculada</p>
                <p className="text-xs text-text-tertiary mt-0.5">Esta call não tem ID de reunião no tl;dv.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Assign Snippet Modal ────────────────────────────────────────────────────

interface AssignModalProps {
  snippet: Snippet
  closers: string[]
  onClose: () => void
}

function AssignSnippetModal({ snippet, closers, onClose }: AssignModalProps) {
  const [assignedTo, setAssignedTo] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function handleAssign() {
    if (!assignedTo) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('snippet_assignments').insert({
        snippet_id: snippet.id,
        assigned_to: assignedTo,
        assigned_to_email: assignedTo,
        assigned_by: user?.id ?? null,
        assigned_by_email: user?.email ?? null,
        note: note.trim() || null,
      })
    setSaving(false)
    setDone(true)
    setTimeout(onClose, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold">Enviar como tarefa</h2>
            <p className="text-xs text-text-tertiary mt-0.5 truncate max-w-56">{snippet.title}</p>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>
        {done ? (
          <div className="flex flex-col items-center gap-2 py-8 px-5">
            <div className="w-10 h-10 rounded-full bg-signal-green/15 flex items-center justify-center">
              <Check size={18} className="text-signal-green" />
            </div>
            <p className="text-sm font-semibold text-signal-green">Tarefa enviada!</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Enviar para</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                className="bg-bg-elevated border border-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-border-mid">
                <option value="">— Selecione um closer —</option>
                {closers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Nota (opcional)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="Ex.: Assista antes da próxima call de objeção de preço..."
                rows={3} className="bg-bg-elevated border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-bg-elevated border border-border text-text-secondary hover:text-text-primary transition-colors">Cancelar</button>
              <button disabled={!assignedTo || saving} onClick={handleAssign}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-g4-red text-white hover:opacity-90 transition-opacity disabled:opacity-40">
                {saving ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Snippet Card ────────────────────────────────────────────────────────────

type SnippetWithCall = Snippet & { calls?: { tldv_call_id: string | null; tldv_url: string | null } | null }

interface SnippetCardProps {
  snippet: SnippetWithCall
  highlighted?: boolean
  canAssign: boolean
  onAssign: (s: Snippet) => void
  onPlay: (s: SnippetWithCall) => void
}

function SnippetCard({ snippet, highlighted, canAssign, onAssign, onPlay }: SnippetCardProps) {
  const [expanded, setExpanded] = useState(false)
  const viewTracked = useRef(false)

  function handleExpand() {
    const next = !expanded
    setExpanded(next)
    if (next && !viewTracked.current) {
      viewTracked.current = true
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return
        supabase
          .from('snippet_views').upsert(
            {
              snippet_id: snippet.id,
              user_id: data.user.id,
              viewed_by_email: data.user.email ?? null,
              completed: false,
              watch_time_seconds: 0,
            },
            { onConflict: 'snippet_id,user_id', ignoreDuplicates: true },
          ).then(() => { })
      })
    }
  }

  return (
    <div className={cn('card hover:border-border-mid transition-colors', highlighted && 'border-signal-blue/30 bg-bg-card2')}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onPlay(snippet)}
          title="Reproduzir"
          className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0 hover:bg-g4-red/20 hover:text-g4-red transition-colors cursor-pointer"
        >
          <Play size={13} className="text-g4-red" />
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={handleExpand}>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold leading-tight">{snippet.title}</h3>
            {snippet.tag && <span className="badge badge-blue">{snippet.tag}</span>}
          </div>
          <p className={cn('text-xs text-text-secondary leading-relaxed transition-all', expanded ? '' : 'line-clamp-2')}>
            {snippet.transcript_excerpt}
          </p>
          {snippet.start_second != null && (
            <p className="text-xs text-text-tertiary mt-1.5 font-mono">{snippet.start_second}s — {snippet.end_second}s</p>
          )}
        </div>
        {canAssign && (
          <button onClick={e => { e.stopPropagation(); onAssign(snippet) }} title="Enviar como tarefa"
            className="shrink-0 p-1.5 rounded-lg text-text-tertiary hover:text-signal-blue hover:bg-signal-blue/10 transition-colors">
            <Send size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Gap recommendation logic ────────────────────────────────────────────────

const GAP_TO_TAG: Record<string, string> = {
  spiced_situation: 'spiced', spiced_pain: 'spiced', spiced_impact: 'spiced',
  spiced_critical_event: 'spiced', spiced_decision: 'spiced',
  spin_situation: 'spin', spin_problem: 'spin', spin_implication: 'spin', spin_need_payoff: 'spin',
  challenger_teach: 'challenger', challenger_tailor: 'challenger', challenger_take_control: 'challenger',
}

const GAP_LABEL: Record<string, string> = {
  spiced_situation: 'Situação (SPICED)', spiced_pain: 'Dor (SPICED)', spiced_impact: 'Impacto (SPICED)',
  spiced_critical_event: 'Evento Crítico (SPICED)', spiced_decision: 'Decisão (SPICED)',
  spin_situation: 'Situação (SPIN)', spin_problem: 'Problema (SPIN)',
  spin_implication: 'Implicação (SPIN)', spin_need_payoff: 'Need-Payoff (SPIN)',
  challenger_teach: 'Teach (Challenger)', challenger_tailor: 'Tailor (Challenger)',
  challenger_take_control: 'Take Control (Challenger)',
}

function useMyGaps(closerEmail: string | null) {
  const [gaps, setGaps] = useState<Array<{ key: string; score: number }>>([])

  useEffect(() => {
    if (!closerEmail) return
    // methodology_scores table removed — gap recommendations disabled
    // TODO: re-enable when framework_scores join is available across schema views
    setGaps([])
  }, [closerEmail])

  return gaps
}

// ─── Updated useSnippets with call join ──────────────────────────────────────

const SNIPPET_PAGE_SIZE = 48

function useSnippetsWithCalls(filter?: { tag?: string }) {
  const [snippets, setSnippets] = useState<SnippetWithCall[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
    setSnippets([])
  }, [filter?.tag])

  useEffect(() => {
    const from = page * SNIPPET_PAGE_SIZE
    const to = from + SNIPPET_PAGE_SIZE - 1

    if (page === 0) setLoading(true)
    else setLoadingMore(true)

    // TODO: cross-view join gp_snippets→gp_calls won't work — keeping public tables for join
    let query = supabase
      .from('snippets')
      .select('*, calls(tldv_call_id, tldv_url)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (filter?.tag) query = query.eq('tag', filter.tag)

    query.then(({ data }) => {
      const rows = (data ?? []) as unknown as SnippetWithCall[]
      setSnippets(prev => page === 0 ? rows : [...prev, ...rows])
      setHasMore(rows.length === SNIPPET_PAGE_SIZE)
      setLoading(false)
      setLoadingMore(false)
    })
  }, [filter?.tag, page])

  const loadMore = () => setPage(p => p + 1)

  return { snippets, loading, loadingMore, hasMore, loadMore }
}

// ─── Pending approval hook ───────────────────────────────────────────────────

function usePendingSnippets() {
  const [pending, setPending] = useState<SnippetWithCall[]>([])

  async function load() {
    // TODO: cross-view join gp_snippets→gp_calls won't work — keeping public tables for join
    const { data } = await supabase
      
      .from('snippets')
      .select('*, calls(tldv_call_id, tldv_url)')
      .eq('is_public', false)
      .order('created_at', { ascending: false })
      .limit(20)
    setPending((data ?? []) as unknown as SnippetWithCall[])
  }

  useEffect(() => { load() }, [])

  async function approve(id: string) {
    await supabase
      .from('snippets').update({
        is_public: true,
        approved_at: new Date().toISOString(),
      }).eq('id', id)
    setPending(prev => prev.filter(s => s.id !== id))
  }

  async function reject(id: string) {
    await supabase
      .from('snippets').delete().eq('id', id)
    setPending(prev => prev.filter(s => s.id !== id))
  }

  return { pending, approve, reject }
}

// ─── Create Game Film Modal ──────────────────────────────────────────────────

interface CreateGameFilmModalProps {
  onClose: () => void
  onCreated: () => void
}

function CreateGameFilmModal({ onClose, onCreated }: CreateGameFilmModalProps) {
  const [form, setForm] = useState({
    title: '',
    transcript_excerpt: '',
    tag: 'spiced' as string,
    call_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!form.title.trim() || !form.transcript_excerpt.trim()) {
      setError('Título e trecho da transcrição são obrigatórios.')
      return
    }
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase
      .from('snippets')
      .insert(
        buildSnippetInsertPayload({
          callId: form.call_id,
          title: form.title,
          excerpt: form.transcript_excerpt,
          tag: form.tag,
          userId: user?.id ?? null,
        }),
      )
    setSaving(false)
    if (err) { setError(err.message); return }
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold">Criar Game Film</h2>
            <p className="text-xs text-text-tertiary mt-0.5">Snippet ficará em revisão até aprovação do coordenador</p>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-signal-red/10 border border-signal-red/20 rounded-xl text-xs text-signal-red">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex.: Tratamento de objeção de preço — Carlos"
              className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Trecho da Transcrição *</label>
            <textarea
              value={form.transcript_excerpt}
              onChange={e => setForm(f => ({ ...f, transcript_excerpt: e.target.value }))}
              placeholder="Cole aqui o trecho relevante da call que exemplifica a técnica ou lição..."
              rows={5}
              className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Tag / Framework</label>
              <select
                value={form.tag}
                onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
                className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-secondary focus:outline-none focus:border-border-mid"
              >
                {TAGS.filter(t => t !== 'Todos').map(t => (
                  <option key={t} value={t}>{TAG_LABELS[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">ID da Call (opcional)</label>
              <input
                type="text"
                value={form.call_id}
                onChange={e => setForm(f => ({ ...f, call_id: e.target.value }))}
                placeholder="UUID da call"
                className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-bg-elevated border border-border text-text-secondary hover:text-text-primary transition-colors">
              Cancelar
            </button>
            <button disabled={saving} onClick={handleCreate}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-g4-red text-white hover:opacity-90 transition-opacity disabled:opacity-40">
              {saving ? 'Criando…' : 'Criar Game Film'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Library() {
  const [selectedTag, setSelectedTag] = useState('Todos')
  const [assignTarget, setAssignTarget] = useState<Snippet | null>(null)
  const [playTarget, setPlayTarget] = useState<SnippetWithCall | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { snippets, loading, loadingMore, hasMore, loadMore } = useSnippetsWithCalls(
    selectedTag !== 'Todos' ? { tag: selectedTag } : undefined
  )
  const { viewedRole, simulatedCloser, isAdmin } = useRole()
  const isExecutivoView = viewedRole === 'executivo'
  const canAssign = isAdmin || viewedRole === 'coordenador'
  const canApprove = isAdmin || viewedRole === 'coordenador'
  const { pending, approve, reject } = usePendingSnippets()
  const closers = useCloserList()

  const [myEmail, setMyEmail] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyEmail(data.user?.email ?? null))
  }, [])

  const closerEmail = isExecutivoView ? (simulatedCloser ?? myEmail) : null
  const gaps = useMyGaps(closerEmail)
  const { snippets: recommendedSnippets } = useSnippetsWithCalls(
    gaps.length > 0 ? { tag: GAP_TO_TAG[gaps[0].key] } : undefined
  )
  const recommendations = gaps.length > 0
    ? recommendedSnippets.filter(s => s.tag === GAP_TO_TAG[gaps[0].key]).slice(0, 3)
    : []

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-end justify-between">
        <div>
          <p className="section-eyebrow">Biblioteca</p>
          <h1 className="text-2xl font-bold">Game Films</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-g4-red text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          Criar Game Film
        </button>
      </div>

      {canApprove && pending.length > 0 && (
        <div className="p-4 bg-bg-card2 border border-signal-amber/20 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={13} className="text-signal-amber" />
            <span className="text-xs font-bold uppercase tracking-widest text-signal-amber">
              Aguardando aprovação ({pending.length})
            </span>
          </div>
          <div className="space-y-2">
            {pending.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-bg-elevated rounded-xl border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.title}</p>
                  <p className="text-xs text-text-tertiary line-clamp-1 mt-0.5">{s.transcript_excerpt}</p>
                </div>
                {s.tag && <span className="badge badge-blue shrink-0">{s.tag}</span>}
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => approve(s.id)}
                    title="Aprovar"
                    className="p-1.5 rounded-lg text-text-tertiary hover:text-signal-green hover:bg-signal-green/10 transition-colors"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    onClick={() => reject(s.id)}
                    title="Rejeitar"
                    className="p-1.5 rounded-lg text-text-tertiary hover:text-signal-red hover:bg-signal-red/10 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isExecutivoView && gaps.length > 0 && (
        <div className="p-4 bg-bg-card2 border border-signal-blue/20 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-signal-blue" />
            <span className="text-xs font-bold uppercase tracking-widest text-signal-blue">Recomendado para você</span>
          </div>
          <p className="text-xs text-text-secondary">
            Seus maiores gaps: {gaps.map(g => GAP_LABEL[g.key]).join(', ')}. Veja esses snippets para melhorar:
          </p>
          {recommendations.length > 0 ? (
            <div className="space-y-2">
              {recommendations.map(s => (
                <SnippetCard key={s.id} snippet={s} highlighted canAssign={false}
                  onAssign={setAssignTarget} onPlay={setPlayTarget} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-tertiary">Nenhum snippet disponível para esses gaps ainda.</p>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {TAGS.map(tag => (
          <button key={tag} onClick={() => setSelectedTag(tag)}
            className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
              selectedTag === tag ? 'bg-g4-red text-white' : 'bg-bg-card border border-border text-text-secondary hover:text-text-primary')}>
            {TAG_LABELS[tag] ?? tag}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-text-tertiary">
        <BookOpen size={12} />
        <span>{snippets.length} snippets{selectedTag !== 'Todos' ? ` em "${TAG_LABELS[selectedTag]}"` : ''}</span>
      </div>

      {loading ? (
        <p className="text-text-tertiary text-sm">Carregando...</p>
      ) : snippets.length === 0 ? (
        <div className="py-12 text-center">
          <Star size={20} className="text-text-tertiary mx-auto mb-2" />
          <p className="text-text-tertiary text-sm">
            Nenhum snippet {selectedTag !== 'Todos' ? `com tag "${TAG_LABELS[selectedTag]}"` : 'ainda'}.
          </p>
          <p className="text-text-tertiary text-xs mt-1">Crie snippets a partir do Detalhe de uma Call.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {snippets.map(s => (
              <SnippetCard key={s.id} snippet={s} canAssign={canAssign}
                onAssign={setAssignTarget} onPlay={setPlayTarget} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:text-text-primary hover:border-text-secondary transition-all disabled:opacity-50"
              >
                {loadingMore ? 'Carregando...' : `Carregar mais ${SNIPPET_PAGE_SIZE}`}
              </button>
            </div>
          )}
        </>
      )}

      {assignTarget && (
        <AssignSnippetModal snippet={assignTarget} closers={closers} onClose={() => setAssignTarget(null)} />
      )}

      {playTarget && (
        <VideoPlayerModal snippet={playTarget} onClose={() => setPlayTarget(null)} />
      )}

      {showCreate && (
        <CreateGameFilmModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            // Reload pending list so coord sees new submission
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
