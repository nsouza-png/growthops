import { useState, useEffect } from 'react'
import { Users, Shield, UserCheck, Plus, Search, ChevronDown, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import { useRole } from '../contexts/RoleContext'
import type { Role } from '../types/database'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Types ───────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  user_id: string
  role: Role
  email: string | null
  squad: string | null
  preferred_name: string | null
  is_active: boolean | null
  onboarding_completed: boolean | null
  created_at: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<Role, string> = {
  executivo: 'Closer',
  coordenador: 'Coordenador',
  admin: 'Admin',
  user: 'User',
}

const ROLE_COLORS: Record<Role, string> = {
  executivo: 'bg-signal-blue/15 text-signal-blue border-signal-blue/20',
  coordenador: 'bg-signal-amber/15 text-signal-amber border-signal-amber/20',
  admin: 'bg-signal-red/15 text-signal-red border-signal-red/20',
  user: 'bg-bg-elevated text-text-secondary border-border',
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      
      .from('user_roles')
      .select('id, user_id, role, email, squad, preferred_name, is_active, onboarding_completed, created_at')
      .order('created_at', { ascending: false })
    setMembers((data ?? []) as TeamMember[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateMember(id: string, updates: Partial<TeamMember>) {
    await supabase
      .from('user_roles').update(updates).eq('id', id)
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
  }

  async function deactivateMember(id: string) {
    await updateMember(id, { is_active: false })
  }

  return { members, loading, updateMember, deactivateMember, reload: load }
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────

interface AddMemberModalProps {
  onClose: () => void
  onSaved: () => void
}

function AddMemberModal({ onClose, onSaved }: AddMemberModalProps) {
  const [form, setForm] = useState({ email: '', role: 'executivo' as Role, squad: '', preferred_name: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const emailTrimmed = form.email.trim().toLowerCase()
    if (!emailTrimmed) { setError('Email é obrigatório'); return }
    if (!EMAIL_RE.test(emailTrimmed)) { setError('Email inválido'); return }
    setSaving(true)
    setError(null)
    // Duplicate check
    const { data: existing } = await supabase
      
      .from('user_roles')
      .select('id')
      .eq('email', emailTrimmed)
      .maybeSingle()
    if (existing) {
      setSaving(false)
      setError('Este email já está cadastrado')
      return
    }
    const { error: err } = await supabase
      .from('user_roles').insert({
        email: emailTrimmed,
        role: form.role,
        squad: form.squad.trim() || null,
        preferred_name: form.preferred_name.trim() || null,
        is_active: true,
        onboarding_completed: false,
      })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold">Adicionar Membro</h2>
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
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="closer@g4educacao.com"
              className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Nome Preferido</label>
            <input
              type="text"
              value={form.preferred_name}
              onChange={e => setForm(f => ({ ...f, preferred_name: e.target.value }))}
              placeholder="Ex.: João"
              className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-secondary focus:outline-none focus:border-border-mid"
              >
                <option value="executivo">Closer (Executivo)</option>
                <option value="coordenador">Coordenador</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Squad</label>
              <input
                type="text"
                value={form.squad}
                onChange={e => setForm(f => ({ ...f, squad: e.target.value }))}
                placeholder="Ex.: Alpha"
                className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-bg-elevated border border-border text-text-secondary hover:text-text-primary transition-colors">
              Cancelar
            </button>
            <button disabled={saving} onClick={handleSave}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-g4-red text-white hover:opacity-90 transition-opacity disabled:opacity-40">
              {saving ? 'Salvando…' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Role Badge ────────────────────────────────────────────────────────────────

interface RoleBadgeProps {
  member: TeamMember
  canEdit: boolean
  onUpdate: (id: string, updates: Partial<TeamMember>) => void
}

function RoleBadge({ member, canEdit, onUpdate }: RoleBadgeProps) {
  const [open, setOpen] = useState(false)

  if (!canEdit) {
    return (
      <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-lg border', ROLE_COLORS[member.role])}>
        {ROLE_LABELS[member.role]}
      </span>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-opacity hover:opacity-80', ROLE_COLORS[member.role])}
      >
        {ROLE_LABELS[member.role]}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-10 bg-bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]">
          {(['executivo', 'coordenador', 'admin'] as Role[]).map(r => (
            <button
              key={r}
              onClick={() => { onUpdate(member.id, { role: r }); setOpen(false) }}
              className={cn(
                'w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 hover:bg-bg-elevated transition-colors',
                r === member.role ? 'text-text-primary' : 'text-text-secondary',
              )}
            >
              {r === member.role && <Check size={10} className="text-signal-green" />}
              {r !== member.role && <span className="w-2.5" />}
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const { isAdmin } = useRole()
  const { members, loading, updateMember, deactivateMember, reload } = useTeamMembers()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = members.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.email?.toLowerCase().includes(q) ||
      m.preferred_name?.toLowerCase().includes(q) ||
      m.squad?.toLowerCase().includes(q) ||
      m.role.includes(q)
    )
  })

  const stats = {
    closers: members.filter(m => m.role === 'executivo' && m.is_active !== false).length,
    coordenadores: members.filter(m => m.role === 'coordenador' && m.is_active !== false).length,
    admins: members.filter(m => m.role === 'admin' && m.is_active !== false).length,
  }

  function initials(m: TeamMember) {
    const name = m.preferred_name ?? m.email?.split('@')[0] ?? '?'
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1">Administração</p>
          <h1 className="text-2xl font-bold">Gestão de Equipe</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-g4-red text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          Adicionar Membro
        </button>
      </div>

      {/* Stats bento */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-3 right-3 opacity-10">
            <Users size={48} className="text-signal-blue" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">Total de Closers</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-text-primary">{stats.closers}</span>
          </div>
        </div>
        <div className="bg-bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-3 right-3 opacity-10">
            <Shield size={48} className="text-signal-amber" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">Coordenadores</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-text-primary">{stats.coordenadores}</span>
          </div>
        </div>
        <div className="bg-bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-3 right-3 opacity-10">
            <UserCheck size={48} className="text-signal-red" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">Administradores</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-text-primary">{stats.admins}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-3">
          <h3 className="font-bold text-text-primary">Diretório da Equipe</h3>
          <div className="relative w-full sm:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar membro..."
              className="w-full bg-bg-elevated border border-border rounded-lg py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-bg-elevated rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-bg-card2">
                  <th className="py-3 px-5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Membro</th>
                  <th className="py-3 px-5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Cargo</th>
                  <th className="py-3 px-5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Squad</th>
                  <th className="py-3 px-5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Status</th>
                  <th className="py-3 px-5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-text-tertiary">
                      {search ? 'Nenhum membro encontrado.' : 'Nenhum membro cadastrado.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(m => (
                    <tr key={m.id} className={cn(
                      'hover:bg-bg-elevated/50 transition-colors',
                      m.is_active === false && 'opacity-50',
                    )}>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-g4-red/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-g4-red">{initials(m)}</span>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-text-primary">
                              {m.preferred_name ?? m.email?.split('@')[0] ?? 'Sem nome'}
                            </div>
                            <div className="text-xs text-text-tertiary truncate max-w-[180px]">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <RoleBadge member={m} canEdit={isAdmin} onUpdate={updateMember} />
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="text-sm text-text-secondary">{m.squad ?? '—'}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        {m.is_active === false ? (
                          <span className="text-[10px] font-bold bg-bg-elevated text-text-tertiary px-2.5 py-1 rounded-lg border border-border">
                            Inativo
                          </span>
                        ) : m.onboarding_completed ? (
                          <span className="text-[10px] font-bold bg-signal-green/10 text-signal-green px-2.5 py-1 rounded-lg border border-signal-green/20">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-signal-blue/10 text-signal-blue px-2.5 py-1 rounded-lg border border-signal-blue/20">
                            Onboarding
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {m.is_active !== false && (
                          <button
                            onClick={() => deactivateMember(m.id)}
                            className="text-[10px] font-medium text-text-tertiary hover:text-signal-red transition-colors px-2 py-1 rounded hover:bg-signal-red/10"
                          >
                            Desativar
                          </button>
                        )}
                        {m.is_active === false && (
                          <button
                            onClick={() => updateMember(m.id, { is_active: true })}
                            className="text-[10px] font-medium text-text-tertiary hover:text-signal-green transition-colors px-2 py-1 rounded hover:bg-signal-green/10"
                          >
                            Reativar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onSaved={reload}
        />
      )}
    </div>
  )
}
