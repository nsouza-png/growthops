import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ToggleLeft, Shield, Lock, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { SmartTracker, TrackerCategory } from '../types/database'
import { cn } from '../lib/cn'
import { useRole } from '../contexts/RoleContext'

const CATEGORIES: TrackerCategory[] = ['concorrente', 'objecao', 'sinal_compra', 'churn', 'custom']
const CAT_LABELS: Record<TrackerCategory, string> = {
  concorrente: 'Concorrente',
  objecao: 'Objeção',
  sinal_compra: 'Sinal de Compra',
  churn: 'Churn',
  custom: 'Customizado',
}
const CAT_COLORS: Record<TrackerCategory, string> = {
  concorrente: 'text-signal-amber badge-amber',
  objecao: 'text-signal-red badge-red',
  sinal_compra: 'text-signal-green badge-green',
  churn: 'text-signal-red badge-red',
  custom: 'text-signal-blue badge-blue',
}

export default function Settings() {
  const navigate = useNavigate()
  const { realRole: role, loading: roleLoading } = useRole()
  const [trackers, setTrackers] = useState<SmartTracker[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', category: 'objecao' as TrackerCategory })
  const [saving, setSaving] = useState(false)

  async function loadTrackers() {
    const { data } = await supabase
      .from('smart_trackers').select('*').order('created_at', { ascending: false })
    setTrackers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadTrackers() }, [])

  if (roleLoading) return null
  if (role === 'executivo') {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center" style={{ minHeight: 320 }}>
        <Lock size={32} className="text-text-tertiary" />
        <p className="text-base font-semibold">Acesso restrito</p>
        <p className="text-sm text-text-tertiary">Apenas coordenadores e admins podem acessar as configurações.</p>
      </div>
    )
  }

  async function createTracker() {
    if (!form.name.trim() || !form.description.trim()) return
    setSaving(true)
    await supabase
      .from('smart_trackers').insert({
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        is_active: true,
      })
    setForm({ name: '', description: '', category: 'objecao' })
    setShowForm(false)
    await loadTrackers()
    setSaving(false)
  }

  async function toggleTracker(id: string, isActive: boolean) {
    await supabase
      .from('smart_trackers').update({ is_active: !isActive }).eq('id', id)
    setTrackers(prev => prev.map(t => t.id === id ? { ...t, is_active: !isActive } : t))
  }

  async function deleteTracker(id: string) {
    await supabase
      .from('smart_trackers').delete().eq('id', id)
    setTrackers(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <p className="section-eyebrow">Administração</p>
        <h1 className="text-2xl font-bold">Configurações de Inteligência</h1>
      </div>

      {/* Smart Trackers */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Smart Trackers</h2>
            <p className="text-xs text-text-tertiary mt-0.5">Sinais detectados automaticamente em cada call pela IA</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={14} />
            Novo tracker
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="mb-4 p-4 bg-bg-card2 rounded-xl border border-border space-y-3">
            <input
              type="text"
              placeholder="Nome do tracker (ex: Objeção de Preço)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
            />
            <textarea
              placeholder="Descrição para a IA — contexto e exemplos de frases que ativariam esse tracker"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid resize-none"
            />
            <div className="flex gap-2">
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as TrackerCategory }))}
                className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-secondary focus:outline-none focus:border-border-mid"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
              <button onClick={createTracker} disabled={saving} className="btn-primary">
                {saving ? 'Salvando...' : 'Criar'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
            </div>
          </div>
        )}

        {/* Tracker list */}
        {loading ? (
          <p className="text-text-tertiary text-sm">Carregando...</p>
        ) : trackers.length === 0 ? (
          <p className="text-text-tertiary text-sm">Nenhum tracker criado ainda.</p>
        ) : (
          <div className="space-y-2">
            {trackers.map(t => (
              <div
                key={t.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border transition-colors',
                  t.is_active ? 'bg-bg-card2 border-border' : 'bg-bg-base border-border/40 opacity-50',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{t.name}</span>
                    <span className={`badge ${CAT_COLORS[t.category]}`}>{CAT_LABELS[t.category]}</span>
                    {!t.is_active && <span className="badge bg-bg-elevated text-text-tertiary">Inativo</span>}
                  </div>
                  <p className="text-xs text-text-tertiary line-clamp-2">{t.description}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleTracker(t.id, t.is_active)}
                    className={cn('btn-ghost p-2', t.is_active ? 'text-signal-green' : 'text-text-tertiary')}
                    title={t.is_active ? 'Desativar' : 'Ativar'}
                  >
                    <ToggleLeft size={14} />
                  </button>
                  <button
                    onClick={() => deleteTracker(t.id)}
                    className="btn-ghost p-2 text-text-tertiary hover:text-signal-red"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Access management */}
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Shield size={16} className="text-text-tertiary mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold mb-1">Gestão de Acesso</h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                Gerencie roles e squads do time. Roles disponíveis: <strong>executivo</strong> (closer), <strong>coordenador</strong>, <strong>admin</strong>.
              </p>
            </div>
          </div>
          {role === 'admin' && (
            <button
              onClick={() => navigate('/settings/users')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated text-text-secondary hover:bg-bg-elevated/80 hover:text-text-primary transition-colors text-xs font-semibold shrink-0"
            >
              <Users size={13} />
              Gerenciar equipe
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
