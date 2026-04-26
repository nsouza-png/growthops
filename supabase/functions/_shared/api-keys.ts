/**
 * Secure API Key Management
 * Hash-based validation with database storage
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std/crypto/mod.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export interface APIKeyData {
  id: string
  name: string
  permissions: string[]
  rateLimit: number
  isActive: boolean
  lastUsed?: string
  expiresAt?: string
  metadata: any
}

export interface APIKeyValidation {
  valid: boolean
  keyData?: APIKeyData
  error?: string
}

// Generate SHA-256 hash of API key
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Validate API key against database
export async function validateApiKey(apiKey: string): Promise<APIKeyValidation> {
  try {
    if (!apiKey) {
      return { valid: false, error: 'API key required' }
    }

    const keyHash = await hashApiKey(apiKey)
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })

    const { data: keyData, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('API key validation error:', error)
      return { valid: false, error: 'Invalid API key' }
    }

    // Check expiration
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return { valid: false, error: 'API key expired' }
    }

    // Update last used timestamp
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyData.id)

    return {
      valid: true,
      keyData: {
        id: keyData.id,
        name: keyData.name,
        permissions: keyData.permissions,
        rateLimit: keyData.rate_limit,
        isActive: keyData.is_active,
        lastUsed: keyData.last_used_at,
        expiresAt: keyData.expires_at,
        metadata: keyData.metadata
      }
    }
  } catch (error) {
    console.error('API key validation error:', error)
    return { valid: false, error: 'Authentication failed' }
  }
}

// Create new API key
export async function createApiKey(
  name: string,
  permissions: string[],
  rateLimit: number,
  createdBy: string,
  expiresAt?: string
): Promise<{ key: string; keyData: APIKeyData }> {
  try {
    // Generate random API key
    const key = `gsk_${crypto.randomUUID().replace(/-/g, '')}`
    const keyHash = await hashApiKey(key)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        name,
        key_hash: keyHash,
        permissions,
        rate_limit: rateLimit,
        created_by: createdBy,
        expires_at: expiresAt
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error('Failed to create API key')
    }

    return {
      key,
      keyData: {
        id: data.id,
        name: data.name,
        permissions: data.permissions,
        rateLimit: data.rate_limit,
        isActive: data.is_active,
        expiresAt: data.expires_at,
        metadata: data.metadata
      }
    }
  } catch (error) {
    console.error('Create API key error:', error)
    throw error
  }
}

// Revoke API key
export async function revokeApiKey(keyId: string): Promise<boolean> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId)

    return !error
  } catch (error) {
    console.error('Revoke API key error:', error)
    return false
  }
}

// List API keys (admin only)
export async function listApiKeys(): Promise<APIKeyData[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return (data || []).map(key => ({
      id: key.id,
      name: key.name,
      permissions: key.permissions,
      rateLimit: key.rate_limit,
      isActive: key.is_active,
      lastUsed: key.last_used_at,
      expiresAt: key.expires_at,
      metadata: key.metadata
    }))
  } catch (error) {
    console.error('List API keys error:', error)
    throw error
  }
}
