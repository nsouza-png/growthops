import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import CallHub from './pages/CallHub'
import CallDetail from './pages/CallDetail'
import Library from './pages/Library'
import Settings from './pages/Settings'
import InsightsHub from './pages/InsightsHub'
import InsightDetail from './pages/InsightDetail'
import Login from './pages/Login'
import PDI from './pages/PDI'
import PDIStudySession from './pages/PDIStudySession'
import Onboarding from './pages/Onboarding'
import UrgentQueue from './pages/UrgentQueue'
import UserManagement from './pages/UserManagement'
import PerformancePage from './pages/PerformancePage'
import SmartTrackers from './pages/SmartTrackers'
import Operations from './pages/Operations'
import ResetPassword from './pages/ResetPassword'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import { QueryProvider } from './providers/QueryProvider'

function LoginRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (user) {
    const from = (location.state as { from?: Location })?.from
    return <Navigate to={from?.pathname ?? '/performance'} replace />
  }
  return <Login />
}

function useOnboardingRedirect(user: ReturnType<typeof useAuth>['user']) {
  const [shouldOnboard, setShouldOnboard] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) {
      setShouldOnboard(false)
      return
    }

    let timeoutId: ReturnType<typeof setTimeout>

    async function check() {
      try {
        timeoutId = setTimeout(() => setShouldOnboard(false), 10000)

        const { data } = await supabase
          .from('user_roles')
          .select('role, onboarding_completed')
          .eq('user_id', user!.id)
          .single()

        clearTimeout(timeoutId)

        if (data?.role === 'executivo' && data?.onboarding_completed === false) {
          setShouldOnboard(true)
        } else {
          setShouldOnboard(false)
        }
      } catch {
        clearTimeout(timeoutId)
        setShouldOnboard(false)
      }
    }

    check()
    return () => { if (timeoutId) clearTimeout(timeoutId) }
  }, [user])

  return shouldOnboard
}

function ProtectedRoutes() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const shouldOnboard = useOnboardingRedirect(user)

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-g4-red border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  if (shouldOnboard === null) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-g4-red border-t-transparent animate-spin" />
      </div>
    )
  }

  if (shouldOnboard && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route element={<Layout />}>
        {/* Root redirect → Performance */}
        <Route index element={<Navigate to="/performance" replace />} />

        {/* ── GRUPO 1: PERFORMANCE ─────────────────────────────── */}
        <Route path="/performance" element={<PerformancePage />} />

        {/* ── GRUPO 2: OPERAÇÃO ────────────────────────────────── */}
        <Route path="/calls" element={<CallHub />} />
        <Route path="/calls/:callId" element={<CallDetail />} />

        {/* ── GRUPO 3: INTELIGÊNCIA ────────────────────────────── */}
        <Route path="/insights" element={<InsightsHub />} />
        <Route path="/insights/:insightId" element={<InsightDetail />} />

        {/* ── GRUPO 4: DESENVOLVIMENTO ─────────────────────────── */}
        <Route path="/pdi" element={<PDI />} />
        <Route path="/pdi/:closerEmail" element={<PDI />} />
        <Route path="/pdi/study/:closerEmail?" element={<PDIStudySession />} />
        <Route path="/pdi/library" element={<Library />} />

        {/* ── GRUPO 5: TÁTICO (admin/coord) ────────────────────── */}
        <Route path="/queue" element={<UrgentQueue />} />
        <Route path="/operations" element={<Operations />} />
        <Route path="/settings/trackers" element={<SmartTrackers />} />

        {/* ── RODAPÉ: GESTÃO ───────────────────────────────────── */}
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/users" element={<UserManagement />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-g4-red border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <QueryProvider>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </QueryProvider>
  )
}
