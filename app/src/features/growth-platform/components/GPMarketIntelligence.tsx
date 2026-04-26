// ── GPMarketIntelligence — Market Intelligence Dashboard ─────────────────
import { useState } from 'react'
import { TrendingUp, TrendingDown, Users, Target, Globe, BarChart3, AlertTriangle } from 'lucide-react'
import type { 
  MarketIntelligenceWithRelations, 
  CompetitorAnalysis, 
  MarketTrend, 
  WinLossAnalysis 
} from '../types'

interface GPMarketIntelligenceProps {
  data: MarketIntelligenceWithRelations | null
  loading?: boolean
}

export function GPMarketIntelligence({ data, loading = false }: GPMarketIntelligenceProps) {
  const [activeTab, setActiveTab] = useState<'competitors' | 'trends' | 'winloss'>('competitors')

  if (loading) {
    return (
      <div className="bg-bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 size={20} className="text-[#B9915B] animate-pulse" />
          <span className="text-lg font-semibold text-text-primary">Carregando inteligência de mercado...</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-bg-card border border-border rounded-2xl p-6">
        <div className="flex flex-col items-center gap-4 py-10">
          <AlertTriangle size={32} className="text-text-tertiary" />
          <p className="text-text-secondary text-center">
            Nenhuma inteligência de mercado disponível ainda.
          </p>
          <p className="text-text-tertiary text-sm text-center">
            Os dados serão atualizados conforme novas análises forem realizadas.
          </p>
        </div>
      </div>
    )
  }

  const competitors = data.competitor_analyses || []
  const trends = data.market_trends || []
  const winLossData = data.win_loss_analyses || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe size={20} className="text-[#B9915B]" />
            <h2 className="text-xl font-bold text-text-primary">Inteligência de Mercado</h2>
          </div>
          <div className="text-sm text-text-tertiary">
            Última atualização: {new Date(data.updated_at).toLocaleDateString('pt-BR')}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-bg-card border border-border rounded-xl">
        <div className="flex border-b border-border">
          {[
            { id: 'competitors', label: 'Análise Competitiva', icon: Target },
            { id: 'trends', label: 'Tendências de Mercado', icon: TrendingUp },
            { id: 'winloss', label: 'Análise Win/Loss', icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-[#B9915B] border-b-2 border-[#B9915B]'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'competitors' && <CompetitorsTab competitors={competitors} />}
          {activeTab === 'trends' && <TrendsTab trends={trends} />}
          {activeTab === 'winloss' && <WinLossTab winLossData={winLossData} />}
        </div>
      </div>
    </div>
  )
}

function CompetitorsTab({ competitors }: { competitors: CompetitorAnalysis[] }) {
  const getThreatColor = (level: string) => {
    switch (level) {
      case 'baixo': return 'text-signal-green'
      case 'médio': return 'text-signal-yellow'
      case 'alto': return 'text-signal-red'
      default: return 'text-signal-gray'
    }
  }

  const getPositionBadge = (position: string) => {
    const colors = {
      líder: 'bg-[#B9915B] text-white',
      desafiante: 'bg-orange-500 text-white',
      nicho: 'bg-purple-500 text-white',
      entrada: 'bg-blue-500 text-white',
    }
    return (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[position as keyof typeof colors] || 'bg-gray-500 text-white'}`}>
        {position}
      </span>
    )
  }

  if (competitors.length === 0) {
    return (
      <div className="text-center py-8">
        <Target size={32} className="text-text-tertiary mx-auto mb-3" />
        <p className="text-text-secondary">Nenhuma análise competitiva disponível</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {competitors.map((competitor) => (
        <div key={competitor.id} className="bg-bg-elevated border border-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{competitor.competitor_name}</h3>
              {competitor.website && (
                <a 
                  href={competitor.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-signal-blue hover:underline ml-2"
                >
                  Visitar site
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              {getPositionBadge(competitor.market_position)}
              <span className={`text-sm font-medium ${getThreatColor(competitor.threat_level)}`}>
                {competitor.threat_level === 'alto' && '⚠️ '}
                Risco {competitor.threat_level}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-text-tertiary font-medium mb-1">Equipe</p>
              <p className="text-text-secondary">{competitor.team_size || 'N/A'} pessoas</p>
            </div>
            <div>
              <p className="text-text-tertiary font-medium mb-1">Estágio</p>
              <p className="text-text-secondary">{competitor.funding_stage || 'N/A'}</p>
            </div>
            <div>
              <p className="text-text-tertiary font-medium mb-1">Data Análise</p>
              <p className="text-text-secondary">{new Date(competitor.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          {competitor.key_features.length > 0 && (
            <div className="mt-4">
              <p className="text-text-tertiary font-medium mb-2">Diferenciais</p>
              <div className="flex flex-wrap gap-2">
                {competitor.key_features.map((feature, i) => (
                  <span 
                    key={i}
                    className="text-xs px-2 py-1 bg-[#B9915B]/10 border border-[#B9915B]/30 rounded-md text-[#B9915B]"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(competitor.strengths.length > 0 || competitor.weaknesses.length > 0) && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {competitor.strengths.length > 0 && (
                <div>
                  <p className="text-text-tertiary font-medium mb-2 flex items-center gap-1">
                    <TrendingUp size={14} className="text-signal-green" />
                    Pontos Fortes
                  </p>
                  <ul className="space-y-1 text-sm text-text-secondary">
                    {competitor.strengths.map((strength, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-signal-green mt-0.5">•</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {competitor.weaknesses.length > 0 && (
                <div>
                  <p className="text-text-tertiary font-medium mb-2 flex items-center gap-1">
                    <TrendingDown size={14} className="text-signal-red" />
                    Pontos Fracos
                  </p>
                  <ul className="space-y-1 text-sm text-text-secondary">
                    {competitor.weaknesses.map((weakness, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-signal-red mt-0.5">•</span>
                        {weakness}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TrendsTab({ trends }: { trends: MarketTrend[] }) {
  const getImpactColor = (level: string) => {
    switch (level) {
      case 'baixo': return 'text-signal-green'
      case 'médio': return 'text-signal-yellow'
      case 'alto': return 'text-signal-red'
      default: return 'text-signal-gray'
    }
  }

  const getCategoryIcon = (category: string) => {
    const icons = {
      tecnologia: '💻',
      comportamento: '🧠',
      mercado: '📊',
      regulatório: '📋',
    }
    return icons[category as keyof typeof icons] || '📈'
  }

  if (trends.length === 0) {
    return (
      <div className="text-center py-8">
        <TrendingUp size={32} className="text-text-tertiary mx-auto mb-3" />
        <p className="text-text-secondary">Nenhuma tendência identificada</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {trends.map((trend) => (
        <div key={trend.id} className="bg-bg-elevated border border-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getCategoryIcon(trend.category)}</span>
              <h3 className="text-lg font-semibold text-text-primary">{trend.trend_name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${getImpactColor(trend.impact_level)}`}>
                {trend.impact_level === 'alto' && '🔥 '}
                Impacto {trend.impact_level}
              </span>
            </div>
          </div>

          <p className="text-text-secondary mb-3">{trend.description}</p>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-text-tertiary">Horizonte: {trend.time_horizon}</span>
              <span className="text-text-tertiary">Categoria: {trend.category}</span>
            </div>
            <div className="text-text-tertiary">
              {new Date(trend.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>

          {trend.data_sources.length > 0 && (
            <div className="mt-3">
              <p className="text-text-tertiary font-medium mb-2">Fontes</p>
              <div className="flex flex-wrap gap-2">
                {trend.data_sources.map((source, i) => (
                  <span 
                    key={i}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-md"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function WinLossTab({ winLossData }: { winLossData: WinLossAnalysis[] }) {
  const getOutcomeColor = (outcome: string) => {
    return outcome === 'win' ? 'text-signal-green' : 'text-signal-red'
  }

  const getOutcomeIcon = (outcome: string) => {
    return outcome === 'win' ? '✅' : '❌'
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      preço: 'text-orange-500',
      produto: 'text-purple-500',
      relacionamento: 'text-blue-500',
      timing: 'text-yellow-500',
      outro: 'text-gray-500',
    }
    return colors[category as keyof typeof colors] || 'text-gray-500'
  }

  if (winLossData.length === 0) {
    return (
      <div className="text-center py-8">
        <BarChart3 size={32} className="text-text-tertiary mx-auto mb-3" />
        <p className="text-text-secondary">Nenhuma análise Win/Loss disponível</p>
      </div>
    )
  }

  const winRate = winLossData.filter(wl => wl.outcome === 'win').length / winLossData.length * 100

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="bg-bg-elevated border border-border rounded-xl p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-signal-green">{winLossData.filter(wl => wl.outcome === 'win').length}</p>
            <p className="text-text-tertiary text-sm">Wins</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-signal-red">{winLossData.filter(wl => wl.outcome === 'loss').length}</p>
            <p className="text-text-tertiary text-sm">Losses</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#B9915B]">{winRate.toFixed(1)}%</p>
            <p className="text-text-tertiary text-sm">Taxa Win</p>
          </div>
        </div>
      </div>

      {/* Detailed Analysis */}
      {winLossData.map((analysis) => (
        <div key={analysis.id} className="bg-bg-elevated border border-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getOutcomeIcon(analysis.outcome)}</span>
              <h3 className="text-lg font-semibold text-text-primary">
                {analysis.outcome === 'win' ? 'Vitória' : 'Derrota'} vs {analysis.competitor_name}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${getOutcomeColor(analysis.outcome)}`}>
                {analysis.outcome.toUpperCase()}
              </span>
            </div>
          </div>

          {analysis.deal_id && (
            <div className="mb-3">
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-md">
                Deal ID: {analysis.deal_id}
              </span>
            </div>
          )}

          <div className="mb-3">
            <p className="text-text-tertiary font-medium mb-1">Motivo Principal</p>
            <span className={`text-sm font-medium ${getCategoryColor(analysis.reason_category)}`}>
              {analysis.reason_category}
            </span>
            <p className="text-text-secondary text-sm mt-1">{analysis.specific_reason}</p>
          </div>

          {analysis.lessons_learned.length > 0 && (
            <div>
              <p className="text-text-tertiary font-medium mb-2">Lições Aprendidas</p>
              <ul className="space-y-1 text-sm text-text-secondary">
                {analysis.lessons_learned.map((lesson, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#B9915B] mt-0.5">•</span>
                    {lesson}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-right text-sm text-text-tertiary">
            {new Date(analysis.created_at).toLocaleDateString('pt-BR')}
          </div>
        </div>
      ))}
    </div>
  )
}
