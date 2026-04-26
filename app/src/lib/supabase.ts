import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('[Supabase] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required. Check .env.local')
}

// Auth sempre usa a URL principal do projeto (não o pooler).
// O pooler usa transaction mode que não suporta auth/realtime.

// Runtime and types are aligned to GrowthPlatform schema.
export const supabase = createClient<Database, 'GrowthPlatform'>(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'GrowthPlatform' },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // detectSessionInUrl desabilitado — HashRouter conflita com o fragment do Supabase.
    // O interceptor em main.tsx captura tokens manualmente antes do React montar.
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'x-app-version': import.meta.env.VITE_APP_VERSION ?? '1.0.0' },
  },
})
