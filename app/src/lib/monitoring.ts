/**
 * monitoring.ts
 *
 * Centraliza o setup de error tracking e monitoring de produção.
 * Usa Sentry como provider. Em dev/test, todas as chamadas são no-ops.
 *
 * Uso:
 *   import { initMonitoring, captureError, captureMessage } from './monitoring'
 *   initMonitoring()  // chame uma vez no main.tsx
 */

import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const IS_PROD = import.meta.env.PROD
const RELEASE = import.meta.env.VITE_APP_VERSION as string | undefined

export function initMonitoring() {
  if (!IS_PROD || !DSN) return

  Sentry.init({
    dsn: DSN,
    release: RELEASE,
    environment: 'production',

    // Captura 10% das transações para performance monitoring (free tier)
    tracesSampleRate: 0.1,

    // Não capturar eventos locais acidentais
    beforeSend(event) {
      if (!IS_PROD) return null
      return event
    },

    // Integrações padrão para SPA React
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Captura 1% das sessões + 100% das sessões com erro
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
  })
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!IS_PROD) {
    console.error('[monitoring]', error, context)
    return
  }
  Sentry.withScope(scope => {
    if (context) scope.setExtras(context)
    if (error instanceof Error) {
      Sentry.captureException(error)
    } else {
      Sentry.captureMessage(String(error), 'error')
    }
  })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (!IS_PROD) return
  Sentry.captureMessage(message, level)
}

export function setUser(user: { id: string; email: string } | null) {
  if (!IS_PROD) return
  Sentry.setUser(user)
}

// Exporta o ErrorBoundary do Sentry para wrapping de rotas
export const SentryErrorBoundary = Sentry.ErrorBoundary
