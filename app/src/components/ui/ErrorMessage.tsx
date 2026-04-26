import React from 'react'
import { AlertTriangle, Wifi, RefreshCw } from 'lucide-react'

interface Props {
  error?: string | null
  onRetry?: () => void
  type?: 'network' | 'data' | 'general'
  compact?: boolean
}

export default function ErrorMessage({ 
  error, 
  onRetry, 
  type = 'general',
  compact = false 
}: Props) {
  if (!error) return null

  const getIcon = () => {
    switch (type) {
      case 'network':
        return <Wifi size={16} className="text-signal-orange" />
      case 'data':
        return <AlertTriangle size={16} className="text-signal-red" />
      default:
        return <AlertTriangle size={16} className="text-signal-red" />
    }
  }

  const getMessage = () => {
    switch (type) {
      case 'network':
        return 'Erro de conexão. Verifique sua internet e tente novamente.'
      case 'data':
        return 'Não foi possível carregar os dados. Tente novamente mais tarde.'
      default:
        return error
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 bg-signal-red/10 border border-signal-red/20 rounded-lg">
        {getIcon()}
        <span className="text-sm text-signal-red flex-1">{getMessage()}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="p-1 hover:bg-signal-red/20 rounded transition-colors"
            title="Tentar novamente"
          >
            <RefreshCw size={14} className="text-signal-red" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="flex items-center justify-center w-12 h-12 bg-signal-red/10 rounded-full mb-4">
        {getIcon()}
      </div>
      
      <h3 className="text-lg font-semibold text-text-primary mb-2 text-center">
        {type === 'network' ? 'Erro de conexão' : 'Erro ao carregar dados'}
      </h3>
      
      <p className="text-sm text-text-secondary text-center mb-6 max-w-md">
        {getMessage()}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 bg-signal-blue text-white px-4 py-2 rounded-lg hover:bg-signal-blue/90 transition-colors"
        >
          <RefreshCw size={16} />
          Tentar novamente
        </button>
      )}

      {import.meta.env.DEV && (
        <details className="mt-6 text-center">
          <summary className="text-xs text-text-tertiary cursor-pointer">
            Ver detalhes técnicos
          </summary>
          <div className="mt-2 p-3 bg-bg-secondary border border-border rounded text-xs font-mono text-text-tertiary max-w-md overflow-auto">
            {error}
          </div>
        </details>
      )}
    </div>
  )
}
