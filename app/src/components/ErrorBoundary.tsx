import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { captureError } from '../lib/monitoring'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureError(error, { componentStack: errorInfo.componentStack ?? undefined })
    this.setState({ error, errorInfo })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-base">
          <div className="max-w-md w-full bg-bg-card border border-border rounded-lg p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-g4-founders/15 rounded-full">
                <AlertTriangle className="w-8 h-8 text-g4-founders" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-text-primary mb-2">
              Algo deu errado
            </h1>

            <p className="text-text-secondary mb-6">
              Ocorreu um erro inesperado. Tente atualizar a página ou contate o suporte se o problema persistir.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-text-tertiary hover:text-text-secondary">
                  Detalhes do erro (desenvolvimento)
                </summary>
                <div className="mt-2 p-3 bg-bg-elevated border border-border rounded text-xs text-text-secondary">
                  <p className="font-mono mb-2">{this.state.error.message}</p>
                  <pre className="whitespace-pre-wrap overflow-auto max-h-32">
                    {this.state.error.stack}
                  </pre>
                </div>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-signal-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </button>

              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-bg-elevated border border-border text-text-primary rounded-lg hover:bg-bg-card transition-colors"
              >
                Atualizar página
              </button>
            </div>

            <div className="mt-6 text-xs text-text-tertiary">
              <p>ID do erro: {Date.now()}</p>
              {import.meta.env.DEV && (
                <p className="mt-1">
                  Ambiente: Desenvolvimento
                </p>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    captureError(error, { componentStack: errorInfo?.componentStack ?? undefined })
  }
}
