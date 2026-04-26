import { Outlet, NavLink, useMatch } from 'react-router-dom'
import { BarChart2, Phone, Brain, GraduationCap, AlertTriangle, Settings, LogOut, Zap, Moon, Sun, Radar, Activity } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '../lib/cn'
import { supabase } from '../lib/supabase'
import { useRole } from '../contexts/RoleContext'
import RoleSwitcher from './RoleSwitcher'
import NotificationBell from './NotificationBell'
import { ErrorBoundary } from './ErrorBoundary'

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('g4_dark_mode')
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('g4_dark_mode', String(dark))
  }, [dark])

  return { dark, toggle: () => setDark(d => !d) }
}

/**
 * Sidebar MECE — 5 grupos de primeiro nível + rodapé Gestão
 *
 * Grupo 1 — Performance  (/performance)         → todos
 * Grupo 2 — Chamadas     (/calls)                → todos
 * Grupo 3 — Insights     (/insights)             → todos
 * Grupo 4 — Desenvolvimento (/pdi)               → todos
 * Grupo 5 — Urgência     (/queue)                → admin/coord only
 * Rodapé  — Gestão       (/settings)             → todos
 */
const NAV_MAIN = [
  { to: '/performance', icon: BarChart2,      label: 'Performance',      adminOnly: false },
  { to: '/calls',       icon: Phone,          label: 'Chamadas',         adminOnly: false },
  { to: '/insights',    icon: Radar,          label: 'Radar',            adminOnly: false },
  { to: '/pdi',         icon: GraduationCap,  label: 'Coaching',         adminOnly: false },
  { to: '/queue',       icon: AlertTriangle,  label: 'Urgencia',         adminOnly: true  },
  { to: '/operations',  icon: Activity,       label: 'Operations',       adminOnly: true  },
]

function NavItem({ to, icon: Icon, label, active }: { to: string; icon: React.ElementType; label: string; active?: boolean }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) => cn(
        'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150',
        (isActive || active)
          ? 'bg-g4-red text-white'
          : 'text-text-tertiary hover:bg-bg-elevated hover:text-text-primary',
      )}
    >
      <Icon size={18} />
    </NavLink>
  )
}

export default function Layout() {
  const { isAdmin } = useRole()
  const { dark, toggle } = useDarkMode()

  // Mark /pdi active for all sub-routes (/pdi/library, /pdi/study/*)
  const pdiActive = !!useMatch('/pdi/*')
  // Mark /calls active for /calls/live too
  const callsActive = !!useMatch('/calls/*')
  // Mark /performance active for sub-routes
  const perfActive = !!useMatch('/performance/*')

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base">
      <aside className="flex flex-col w-16 border-r border-border bg-bg-card shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center h-14 border-b border-border shrink-0">
          <div className="w-7 h-7 rounded-lg bg-g4-red flex items-center justify-center">
            <Zap size={14} className="text-white" fill="white" />
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex flex-col items-center gap-1 p-2 flex-1 pt-3">
          {NAV_MAIN.filter(item => !item.adminOnly || isAdmin).map(({ to, icon, label }) => {
            const extraActive =
              to === '/pdi' ? pdiActive :
              to === '/calls' ? callsActive :
              to === '/performance' ? perfActive :
              false
            return (
              <NavItem key={to} to={to} icon={icon} label={label} active={extraActive} />
            )
          })}
        </nav>

        {/* Footer: Gestão + utilidades */}
        <div className="p-2 pb-4 flex flex-col items-center gap-2 border-t border-border pt-3">
          <NavItem to="/settings" icon={Settings} label="Configurações" />
          {isAdmin && <NavItem to="/settings/trackers" icon={Radar} label="Smart Trackers" />}
          <RoleSwitcher />
          <NotificationBell />
          <button
            onClick={toggle}
            title={dark ? 'Modo claro' : 'Modo escuro'}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-text-tertiary hover:bg-bg-elevated hover:text-text-primary transition-all"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={() => supabase.auth.signOut().catch(() => {})}
            title="Sair"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-text-tertiary hover:bg-bg-elevated hover:text-text-primary transition-all"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
