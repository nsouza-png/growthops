import { useState, useEffect } from 'react'
import { Radar, Plus, Pencil, Trash2, Power, X, Search, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { SmartTracker } from '../types/database'

// ─── Constants ───────────────────────────────────────────────────────────────

type TrackerCategory = 'concorrente' | 'objecao' | 'sinal_compra' | 'churn' | 'custom'

const CATEGORY_LABELS: Record<TrackerCategory, string> = {
  concorrente: 'Concorrente',
  objecao: 'Objeção',
  sinal_compra: 'Sinal de Compra',
  churn: 'Churn',
  custom: 'Custom',
}

const CATEGORY_COLORS: Record<TrackerCategory, string> = {
  concorrente: 'bg-signal-blue/15 text-signal-blue border-signal-blue/20',
  objecao: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  sinal_compra: 'bg-signal-green/15 text-signal-green border-signal-green/20',
  churn: 'bg-signal-red/15 text-signal-red border-signal-red/20',
  custom: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
}

const ALL_CATEGORIES: TrackerCategory[] = ['concorrente', 'objecao', 'sinal_compra', 'churn', 'custom']

// ─── Hook ────────────────────────────────────────────────────────────────────

function useSmartTrackers() {
  const [trackers, setTrackers] = useState<SmartTracker[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      
      .from('smart_trackers')
      .select('*')
      .order('created_at', { ascending: false })
    setTrackers((data ?? []) as SmartTracker[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create(tracker: { name: string; description: string; category: TrackerCategory }) {
    const { data, error } = await supabase
      
      .from('smart_trackers')
      .insert({ name: tracker.name, description: tracker.description, category: tracker.category, is_active: true })
      .select()
      .single()
    if (error) throw error
    setTrackers(prev => [data as SmartTracker, ...prev])
    return data
  }

  async function update(id: string, updates: Partial<Pick<SmartTracker, 'name' | 'description' | 'category' | 'is_active'>>) {
    const { error } = await supabase
      .from('smart_trackers').update(updates).eq('id', id)
    if (error) throw error
    setTrackers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from('smart_trackers').delete().eq('id', id)
    if (error) throw error
    setTrackers(prev => prev.filter(t => t.id !== id))
  }

  return { trackers, loading, create, update, remove, reload: load }
}

// ─── Tracker Form Modal ──────────────────────────────────────────────────────

interface TrackerFormProps {
  initial?: SmartTracker | null
  onClose: () => void
  onSave: (data: { name: string; description: string; category: TrackerCategory }) => Promise<void>
}

function TrackerFormModal({ initial, onClose, onSave }: TrackerFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    category: (initial?.category ?? 'custom') as TrackerCategory,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    if (!form.description.trim()) { setError('Descrição é obrigatória'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: form.name.trim(), description: form.description.trim(), category: form.category })
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold">{initial ? 'Editar Tracker' : 'Novo Tracker'}</h2>
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
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Nome *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex.: Concorrente XYZ mencionado"
              className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Descrição *</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descreva o que esse tracker detecta nas chamadas..."
              rows={3}
              className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Categoria</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as TrackerCategory }))}
              className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-secondary focus:outline-none focus:border-border-mid"
            >
              {ALL_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-bg-elevated border border-border text-text-secondary hover:text-text-primary transition-colors">
              Cancelar
            </button>
            <button disabled={saving} onClick={handleSave}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-g4-red text-white hover:opacity-90 transition-opacity disabled:opacity-40">
              {saving ? 'Salvando...' : initial ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirmation Modal ───────────────────────────────────────────────

interface DeleteConfirmProps {
  trackerName: string
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirmModal({ trackerName, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-signal-red/15 flex items-center justify-center shrink-0">
              <Trash2 size={18} className="text-signal-red" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">Excluir Tracker</h3>
              <p className="text-xs text-text-tertiary mt-0.5">Esta ação não pode ser desfeita.</p>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            Tem certeza que deseja excluir <span className="font-semibold text-text-primary">"{trackerName}"</span>?
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-bg-elevated border border-border text-text-secondary hover:text-text-primary transition-colors">
              Cancelar
            </button>
            <button onClick={onConfirm} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-signal-red text-white hover:opacity-90 transition-opacity">
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tracker Card ────────────────────────────────────────────────────────────

interface TrackerCardProps {
  tracker: SmartTracker
  onEdit: (t: SmartTracker) => void
  onToggle: (t: SmartTracker) => void
  onDelete: (t: SmartTracker) => void
}

function TrackerCard({ tracker, onEdit, onToggle, onDelete }: TrackerCardProps) {
  const cat = tracker.category as TrackerCategory
  return (
    <div className={cn(
      'card p-5 rounded-2xl border transition-all',
      tracker.is_active
        ? 'bg-bg-card border-border hover:border-border-mid'
        : 'bg-bg-card/50 border-border/50 opacity-60',
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-bg-elevated flex items-center justify-center shrink-0">
            <Radar size={16} className="text-text-secondary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-text-primary truncate">{tracker.name}</h3>
            <span className={cn(
              'inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border mt-1',
              CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.custom,
            )}>
              {CATEGORY_LABELS[cat] ?? cat}
            </span>
          </div>
        </div>
        <span className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0',
          tracker.is_active
            ? 'bg-signal-green/10 text-signal-green'
            : 'bg-bg-elevated text-text-tertiary',
        )}>
          {tracker.is_active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      <p className="text-xs text-text-secondary leading-relaxed mb-4 line-clamp-2">
        {tracker.description}
      </p>

      <div className="flex items-center gap-1.5 border-t border-border/50 pt-3">
        <button
          onClick={() => onEdit(tracker)}
          title="Editar"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-text-tertiary hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          <Pencil size={12} />
          Editar
        </button>
        <button
          onClick={() => onToggle(tracker)}
          title={tracker.is_active ? 'Desativar' : 'Ativar'}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors',
            tracker.is_active
              ? 'text-text-tertiary hover:text-orange-400 hover:bg-orange-500/10'
              : 'text-text-tertiary hover:text-signal-green hover:bg-signal-green/10',
          )}
        >
          <Power size={12} />
          {tracker.is_active ? 'Desativar' : 'Ativar'}
        </button>
        <button
          onClick={() => onDelete(tracker)}
          title="Excluir"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-text-tertiary hover:text-signal-red hover:bg-signal-red/10 transition-colors ml-auto"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SmartTrackers() {
  const { trackers, loading, create, update, remove } = useSmartTrackers()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<TrackerCategory | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SmartTracker | null>(null)
  const [deleting, setDeleting] = useState<SmartTracker | null>(null)

  const filtered = trackers.filter(t => {
    if (filterCategory !== 'all' && t.category !== filterCategory) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    )
  })

  const stats = {
    total: trackers.length,
    active: trackers.filter(t => t.is_active).length,
    inactive: trackers.filter(t => !t.is_active).length,
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1">Administração</p>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Radar size={24} className="text-g4-red" />
            Smart Trackers
          </h1>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-g4-red text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          Novo Tracker
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-3 right-3 opacity-10">
            <Radar size={48} className="text-signal-blue" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">Total</p>
          <span className="text-4xl font-bold text-text-primary">{stats.total}</span>
        </div>
        <div className="bg-bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-3 right-3 opacity-10">
            <Power size={48} className="text-signal-green" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">Ativos</p>
          <span className="text-4xl font-bold text-text-primary">{stats.active}</span>
        </div>
        <div className="bg-bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-3 right-3 opacity-10">
            <Power size={48} className="text-text-tertiary" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">Inativos</p>
          <span className="text-4xl font-bold text-text-primary">{stats.inactive}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tracker..."
            className="w-full bg-bg-card border border-border rounded-xl py-2.5 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
          />
        </div>
        <div className="relative">
          <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value as TrackerCategory | 'all')}
            className="bg-bg-card border border-border rounded-xl py-2.5 pl-8 pr-4 text-sm text-text-secondary focus:outline-none focus:border-border-mid appearance-none cursor-pointer"
          >
            <option value="all">Todas categorias</option>
            {ALL_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-bg-card border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-12 text-center">
          <Radar size={40} className="mx-auto text-text-tertiary mb-3 opacity-40" />
          <p className="text-sm text-text-tertiary">
            {search || filterCategory !== 'all' ? 'Nenhum tracker encontrado com esses filtros.' : 'Nenhum tracker cadastrado ainda.'}
          </p>
          {!search && filterCategory === 'all' && (
            <button
              onClick={() => { setEditing(null); setShowForm(true) }}
              className="mt-3 text-sm font-semibold text-g4-red hover:underline"
            >
              Criar primeiro tracker
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <TrackerCard
              key={t.id}
              tracker={t}
              onEdit={tracker => { setEditing(tracker); setShowForm(true) }}
              onToggle={tracker => update(tracker.id, { is_active: !tracker.is_active })}
              onDelete={tracker => setDeleting(tracker)}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <TrackerFormModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSave={async (data) => {
            if (editing) {
              await update(editing.id, data)
            } else {
              await create(data)
            }
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleting && (
        <DeleteConfirmModal
          trackerName={deleting.name}
          onConfirm={async () => { await remove(deleting.id); setDeleting(null) }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
