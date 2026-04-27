import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      db: { schema: 'GrowthPlatform' },
      auth: { persistSession: false },
    }
  )
}

const ALLOWED_ORIGINS = [
  'https://nsouza-png.github.io',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
]

export function corsHeaders(req?: Request) {
  const origin = req?.headers.get('origin') ?? ''
  // Allow known origins; fall back to gh-pages origin for unlisted requests
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-version',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  }
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

export function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status)
}
