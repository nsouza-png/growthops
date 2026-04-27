// ── useGrowthPlatform — Profile management for current authenticated user ─────

import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '../../../hooks/useAuth'
import { supabase } from '../../../lib/supabase'
import { GrowthPlatformAPI } from '../services/api'
import type { GrowthPlatformProfile, GPRole } from '../types'

interface UseGrowthPlatformReturn {
  profile: GrowthPlatformProfile | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const GP_ROLES: GPRole[] = ['executivo', 'coordenador', 'gerente', 'diretor', 'sales_ops', 'admin']

function normalizeGPRole(raw: string | null | undefined): GPRole {
  const r = String(raw ?? 'executivo').trim().toLowerCase()
  return (GP_ROLES.includes(r as GPRole) ? r : 'executivo') as GPRole
}

/** Session profile when GrowthPlatform.profiles has no row yet — drives role-based dashboards. */
function sessionProfileFromAuth(user: User): GrowthPlatformProfile {
  const email = (user.email ?? '').toLowerCase().trim()
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const metaName =
    typeof meta?.full_name === 'string'
      ? meta.full_name
      : typeof meta?.name === 'string'
        ? meta.name
        : null
  const name =
    (metaName && metaName.trim()) ||
    email.split('@')[0]?.replace(/[._]/g, ' ') ||
    'Usuário'

  return {
    id: user.id,
    email: email || user.id,
    name,
    cargo: '',
    role: 'executivo',
    squad: null,
    setor: null,
    lider_direto: null,
    data_entrada: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

async function sessionProfileFromUserRoles(user: User): Promise<GrowthPlatformProfile> {
  const { data: ur, error } = await supabase
    .from('user_roles')
    .select('role, email, preferred_name, squad')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.warn('[GP] user_roles lookup:', error.message)
    return sessionProfileFromAuth(user)
  }

  const email = (ur?.email ?? user.email ?? '').toLowerCase().trim()
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const metaName =
    typeof meta?.full_name === 'string'
      ? meta.full_name
      : typeof meta?.name === 'string'
        ? meta.name
        : null
  const pref =
    ur && typeof ur.preferred_name === 'string' && ur.preferred_name.trim()
      ? ur.preferred_name.trim()
      : null
  const name =
    pref ||
    (metaName && metaName.trim()) ||
    email.split('@')[0]?.replace(/[._]/g, ' ') ||
    'Usuário'

  return {
    id: user.id,
    email: email || user.id,
    name,
    cargo: '',
    role: normalizeGPRole(ur?.role as string | undefined),
    squad: typeof ur?.squad === 'string' ? ur.squad : null,
    setor: null,
    lider_direto: null,
    data_entrada: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function useGrowthPlatform(): UseGrowthPlatformReturn {
  const { user } = useAuth()
  const [profile, setProfile] = useState<GrowthPlatformProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Primary: profiles.id is the same UUID as auth.users.id in canonical schema.
      let data = await GrowthPlatformAPI.getProfileByAuthId(user.id)

      // Fallback: lookup by email for profiles synced before first login
      if (!data && user.email) {
        data = await GrowthPlatformAPI.getProfileByEmail(user.email)
      }

      // RLS allows SELECT on profiles but not INSERT — create row via SECURITY DEFINER RPC.
      if (!data) {
        const { error: ensureErr } = await supabase.rpc('ensure_gp_profile')
        if (ensureErr) {
          console.error('[GP] ensure_gp_profile:', ensureErr.message)
        } else {
          data = await GrowthPlatformAPI.getProfileByAuthId(user.id)
        }
      }

      if (!data) {
        const synthetic = await sessionProfileFromUserRoles(user)
        setProfile(synthetic)
        setError(null)
      } else {
        setProfile(data)
        setError(null)
      }
    } catch (e) {
      console.error('[GP] fetchProfile:', e)
      setProfile(sessionProfileFromAuth(user))
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return { profile, loading, error, refetch: fetchProfile }
}
