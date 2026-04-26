import { useState, useRef, useEffect } from 'react'
import { Eye, ChevronDown, ShieldCheck, Users, User } from 'lucide-react'
import { useRole, type AppRole } from '../contexts/RoleContext'
import { cn } from '../lib/cn'

const roles: { value: AppRole; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'admin', label: 'Admin', desc: 'Visão completa', icon: ShieldCheck },
  { value: 'coordenador', label: 'Coordenador', desc: 'Visão do squad', icon: Users },
  { value: 'executivo', label: 'Executivo', desc: 'Visão individual', icon: User },
]

const colors: Record<AppRole, string> = {
  admin: 'text-g4-red border-g4-red/40 bg-g4-red/10',
  coordenador: 'text-signal-blue border-signal-blue/40 bg-signal-blue/10',
  executivo: 'text-signal-green border-signal-green/40 bg-signal-green/10',
}

export default function RoleSwitcher() {
  const { viewedRole, setViewedRole, isAdmin } = useRole()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  if (!isAdmin) return null

  const current = roles.find(r => r.value === viewedRole) ?? roles[0]
  const Icon = current.icon

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Alternar visão de role"
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all',
          colors[viewedRole],
        )}
      >
        <Eye size={11} />
        <span className="hidden xl:inline">{current.label}</span>
        <ChevronDown size={10} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 bottom-10 w-52 bg-bg-card border border-border rounded-xl shadow-lg shadow-black/40 overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider">
              Simulando visão de
            </p>
          </div>
          {roles.map(r => {
            const RIcon = r.icon
            const active = viewedRole === r.value
            return (
              <button
                key={r.value}
                onClick={() => { setViewedRole(r.value); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-bg-elevated',
                  active && 'bg-bg-elevated',
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center border',
                  active ? colors[r.value] : 'border-border text-text-tertiary',
                )}>
                  <RIcon size={13} />
                </div>
                <div>
                  <div className={cn('text-sm font-semibold', active ? 'text-text-primary' : 'text-text-secondary')}>
                    {r.label}
                  </div>
                  <div className="text-[11px] text-text-tertiary">{r.desc}</div>
                </div>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-g4-red" />
                )}
              </button>
            )
          })}
          <p className="text-[10px] text-tertiary italic text-center px-3 py-2 border-t border-border mt-1">
            Modo de visualização — dados reais
          </p>
        </div>
      )}
    </div>
  )
}
