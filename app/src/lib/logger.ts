/**
 * logger.ts
 *
 * Structured frontend logger. Wraps console + Sentry captureError.
 * Use this instead of bare console.error in hooks and pages so that
 * production errors are routed to Sentry with route/module context.
 *
 * Usage:
 *   import { logError } from '../lib/logger'
 *   logError('useUnifiedCalls', err, { limit, vendedor })
 */

import { captureError } from './monitoring'

export function logError(module: string, error: unknown, context?: Record<string, unknown>) {
  const route = typeof window !== 'undefined' ? window.location.pathname : 'unknown'
  const ctx = { module, route, ...context }

  // Always log to console for dev visibility
  console.error(`[${module}]`, error, ctx)

  // Forward to Sentry in prod
  captureError(error, ctx)
}

export function logWarn(module: string, message: string, context?: Record<string, unknown>) {
  const route = typeof window !== 'undefined' ? window.location.pathname : 'unknown'
  console.warn(`[${module}] ${message}`, { route, ...context })
}
