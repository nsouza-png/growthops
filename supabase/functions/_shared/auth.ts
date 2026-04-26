/**
 * JWT Validation for Edge Functions
 * Secure authentication before using service role key
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export interface AuthResult {
  user: any
  error?: string
}

export async function validateJWT(authHeader?: string): Promise<AuthResult> {
  try {
    if (!authHeader) {
      return { user: null, error: 'No authorization header provided' }
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Create Supabase client with service role key for JWT validation
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })

    // Validate JWT and get user
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error) {
      console.error('JWT validation error:', error.message)
      return { user: null, error: 'Invalid or expired token' }
    }

    if (!user) {
      return { user: null, error: 'User not found' }
    }

    // Additional checks
    if (user.banned) {
      return { user: null, error: 'User is banned' }
    }

    return { user }
  } catch (error) {
    console.error('Auth validation error:', error)
    return { user: null, error: 'Authentication failed' }
  }
}

export async function requireAdmin(authHeader?: string): Promise<AuthResult> {
  const auth = await validateJWT(authHeader)
  
  if (!auth.user) {
    return auth
  }

  // Check if user has admin role
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', auth.user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { user: null, error: 'Admin access required' }
  }

  return auth
}

export async function requireRole(authHeader?: string, requiredRole: string): Promise<AuthResult> {
  const auth = await validateJWT(authHeader)
  
  if (!auth.user) {
    return auth
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', auth.user.id)
    .single()

  if (!profile || profile.role !== requiredRole) {
    return { user: null, error: `${requiredRole} access required` }
  }

  return auth
}
