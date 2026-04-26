// ── GPMarketIntelligence — Market Intelligence Page ─────────────────
import { useEffect } from 'react'
import { GPMarketIntelligence } from '../components/GPMarketIntelligence'
import { useMarketIntelligence } from '../hooks/useMarketIntelligence'
import { GrowthPlatformAPI } from '../services/api'

export default function GPMarketIntelligencePage() {
  const { data, loading, error, refreshData } = useMarketIntelligence()

  useEffect(() => {
    // Verificar se existe inteligência de mercado, se não, criar inicial
    async function initializeMarketIntelligence() {
      try {
        const existing = await GrowthPlatformAPI.getMarketIntelligence()
        if (!existing) {
          // Criar inteligência de mercado inicial se não existir
          console.log('[MarketIntelligence] Criando inteligência de mercado inicial...')
        }
      } catch (err) {
        console.error('[MarketIntelligence] Erro ao verificar inteligência existente:', err)
      }
    }

    initializeMarketIntelligence()
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="bg-bg-card border border-border rounded-2xl p-6 max-w-md text-center">
          <h2 className="text-xl font-bold text-text-primary mb-4">Erro ao Carregar</h2>
          <p className="text-text-secondary mb-4">{error}</p>
          <button 
            onClick={refreshData}
            className="px-4 py-2 bg-[#B9915B] text-white rounded-lg hover:bg-[#B9915B]/90 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="bg-bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-text-primary">Inteligência de Mercado</h1>
          <p className="text-text-tertiary">
            Análise competitiva, tendências e insights estratégicos para o time de vendas
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <GPMarketIntelligence data={data} loading={loading} />
      </div>
    </div>
  )
}
