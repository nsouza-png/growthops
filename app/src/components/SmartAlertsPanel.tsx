import { useState } from 'react'
import { AlertTriangle, TrendingUp, TrendingDown, Award, X, CheckCircle, Clock, Target, Lightbulb } from 'lucide-react'
import { useSmartAlerts, type SmartAlert } from '../hooks/useSmartAlerts'
import { cn } from '../lib/cn'

interface SmartAlertsPanelProps {
  className?: string
  compact?: boolean
}

export default function SmartAlertsPanel({ className, compact = false }: SmartAlertsPanelProps) {
  const { alerts, loading, unacknowledgedBySeverity, acknowledgeAlert, addActionToAlert, totalUnacknowledged } = useSmartAlerts()
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)

  const getAlertIcon = (type: SmartAlert['type']) => {
    switch (type) {
      case 'performance_decline': return <TrendingDown size={16} />
      case 'churn_risk': return <AlertTriangle size={16} />
      case 'coaching_opportunity': return <Lightbulb size={16} />
      case 'methodology_gap': return <Target size={16} />
      case 'achievement': return <Award size={16} />
      default: return <AlertTriangle size={16} />
    }
  }

  const getSeverityColor = (severity: SmartAlert['severity']) => {
    switch (severity) {
      case 'critical': return 'border-signal-red bg-signal-red/5 text-signal-red'
      case 'high': return 'border-signal-orange bg-signal-orange/5 text-signal-orange'
      case 'medium': return 'border-signal-amber bg-signal-amber/5 text-signal-amber'
      case 'low': return 'border-signal-green bg-signal-green/5 text-signal-green'
      default: return 'border-border bg-bg-elevated text-text-secondary'
    }
  }

  const getSeverityBadgeColor = (severity: SmartAlert['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-signal-red text-white'
      case 'high': return 'bg-signal-orange text-white'
      case 'medium': return 'bg-signal-amber text-white'
      case 'low': return 'bg-signal-green text-white'
      default: return 'bg-bg-elevated text-text-secondary'
    }
  }

  const handleAcknowledge = async (alertId: string) => {
    await acknowledgeAlert(alertId)
    setExpandedAlert(null)
  }

  const handleAddAction = async (alertId: string, action: string) => {
    await addActionToAlert(alertId, action)
  }

  if (compact) {
    return (
      <div className={cn("relative", className)}>
        {totalUnacknowledged > 0 && (
          <div className="flex items-center gap-2 p-3 bg-bg-elevated border border-border rounded-lg">
            <div className="flex items-center gap-1">
              {unacknowledgedBySeverity.critical.length > 0 && (
                <div className="w-2 h-2 rounded-full bg-signal-red animate-pulse" />
              )}
              {unacknowledgedBySeverity.high.length > 0 && (
                <div className="w-2 h-2 rounded-full bg-signal-orange animate-pulse" />
              )}
            </div>
            <span className="text-sm font-medium text-text-primary">
              {totalUnacknowledged} alerta{totalUnacknowledged !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("bg-bg-card border border-border rounded-xl p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <AlertTriangle size={16} />
          Alertas Inteligentes
          {totalUnacknowledged > 0 && (
            <span className="px-2 py-0.5 bg-signal-blue text-white text-xs rounded-full">
              {totalUnacknowledged}
            </span>
          )}
        </h3>
        
        <div className="flex items-center gap-2 text-xs">
          {unacknowledgedBySeverity.critical.length > 0 && (
            <span className="px-2 py-1 bg-signal-red text-white rounded">
              Crítico: {unacknowledgedBySeverity.critical.length}
            </span>
          )}
          {unacknowledgedBySeverity.high.length > 0 && (
            <span className="px-2 py-1 bg-signal-orange text-white rounded">
              Alto: {unacknowledgedBySeverity.high.length}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-signal-blue"></div>
          <span className="ml-2 text-xs text-text-tertiary">Analisando dados...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle size={24} className="text-signal-green mx-auto mb-2" />
          <p className="text-sm text-text-secondary">Nenhum alerta ativo</p>
          <p className="text-xs text-text-tertiary mt-1">Seu time está performando bem!</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "border rounded-lg p-3 transition-all cursor-pointer",
                getSeverityColor(alert.severity),
                expandedAlert === alert.id && "ring-2 ring-opacity-50",
                alert.acknowledged && "opacity-60"
              )}
              onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={cn("p-1.5 rounded-lg border", getSeverityColor(alert.severity))}>
                    {getAlertIcon(alert.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-text-primary truncate">
                        {alert.title}
                      </h4>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        getSeverityBadgeColor(alert.severity)
                      )}>
                        {alert.severity}
                      </span>
                    </div>
                    
                    <p className="text-xs text-text-secondary mb-2">
                      {alert.description}
                    </p>
                    
                    {alert.metadata.trend && (
                      <div className="flex items-center gap-2 text-xs text-text-tertiary">
                        <Clock size={10} />
                        <span>Tendência: {alert.metadata.trend === 'up' ? 'Crescente' : alert.metadata.trend === 'down' ? 'Decrescente' : 'Estável'}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {!alert.acknowledged && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAcknowledge(alert.id)
                    }}
                    className="text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {expandedAlert === alert.id && (
                <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                  <div className="mb-3">
                    <h5 className="text-xs font-semibold text-text-primary mb-1">Recomendação:</h5>
                    <p className="text-xs text-text-secondary">
                      {alert.recommendation}
                    </p>
                  </div>

                  {alert.metadata.impact_score && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-text-tertiary">Impacto</span>
                        <span className="text-text-primary font-medium">
                          {Math.round(alert.metadata.impact_score * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-bg-elevated rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-signal-blue transition-all"
                          style={{ width: `${alert.metadata.impact_score * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {alert.actions_taken && alert.actions_taken.length > 0 && (
                    <div className="mb-3">
                      <h5 className="text-xs font-semibold text-text-primary mb-1">Ações tomadas:</h5>
                      <ul className="text-xs text-text-secondary space-y-1">
                        {alert.actions_taken.map((action, index) => (
                          <li key={index} className="flex items-center gap-1">
                            <CheckCircle size={8} className="text-signal-green" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!alert.acknowledged && (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAcknowledge(alert.id)
                        }}
                        className="flex-1 px-2 py-1 bg-signal-blue text-white text-xs rounded hover:bg-signal-blue/90 transition-colors"
                      >
                        Reconhecer
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const action = prompt('Qual ação foi tomada?')
                          if (action) {
                            handleAddAction(alert.id, action)
                          }
                        }}
                        className="flex-1 px-2 py-1 border border-border text-xs rounded hover:bg-bg-elevated transition-colors"
                      >
                        Adicionar Ação
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
