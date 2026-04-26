/**
 * Environment Variables Validation for Edge Functions
 * Ensures required variables are present before execution
 */

export interface EnvValidation {
  valid: boolean
  error?: string
}

export function validateRequiredEnvVars(): EnvValidation {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]

  for (const varName of requiredVars) {
    const value = Deno.env.get(varName)
    if (!value) {
      return {
        valid: false,
        error: `Required environment variable ${varName} is not set`
      }
    }
    
    // Validate URL format for SUPABASE_URL
    if (varName === 'SUPABASE_URL') {
      try {
        new URL(value)
      } catch {
        return {
          valid: false,
          error: `Invalid SUPABASE_URL format: ${value}`
        }
      }
    }
    
    // Validate service role key format (should be a JWT)
    if (varName === 'SUPABASE_SERVICE_ROLE_KEY') {
      if (!value.startsWith('eyJ')) {
        return {
          valid: false,
          error: 'SUPABASE_SERVICE_ROLE_KEY appears to be invalid (should start with eyJ)'
        }
      }
    }
  }

  return { valid: true }
}

export function validateOptionalEnvVars(): void {
  const optionalVars = [
    'SLACK_WEBHOOK_URL',
    'REDIS_URL'
  ]

  for (const varName of optionalVars) {
    const value = Deno.env.get(varName)
    if (!value) {
      console.warn(`Optional environment variable ${varName} is not set. Some features may be disabled.`)
    }
  }
}

// Auto-validate on import
const envValidation = validateRequiredEnvVars()
if (!envValidation.valid) {
  throw new Error(`Environment validation failed: ${envValidation.error}`)
}

validateOptionalEnvVars()
