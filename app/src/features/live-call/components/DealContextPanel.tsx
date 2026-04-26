// DealContextPanel.tsx
// Painel de contexto do deal selecionado: exibe perfil, segmento, faixa, ACV,
// produto e score SPICED histórico da última call analisada.

import type { DealContext } from '../hooks/useDealContext'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatACV(acv: number | null): string {
  if (!acv) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(acv)
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DealContextPanelProps {
  dealContext: DealContext
}

// ---------------------------------------------------------------------------
// DealContextPanel
// ---------------------------------------------------------------------------

export function DealContextPanel({ dealContext }: DealContextPanelProps) {
  return (
    <div className="card-sm space-y-3">
      <h3 className="section-eyebrow">Contexto do Deal</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {dealContext.leadPerfil && (
          <div>
            <span className="text-gray-500 text-xs">Perfil</span>
            <p className="text-white font-medium">{dealContext.leadPerfil}</p>
          </div>
        )}
        {dealContext.leadSegmento && (
          <div>
            <span className="text-gray-500 text-xs">Segmento</span>
            <p className="text-white font-medium">{dealContext.leadSegmento}</p>
          </div>
        )}
        {dealContext.leadFaixa && (
          <div>
            <span className="text-gray-500 text-xs">Faixa</span>
            <p className="text-white font-medium">{dealContext.leadFaixa}</p>
          </div>
        )}
        {dealContext.dealAcv !== null && (
          <div>
            <span className="text-gray-500 text-xs">ACV</span>
            <p className="text-g4-red font-bold">{formatACV(dealContext.dealAcv)}</p>
          </div>
        )}
        {dealContext.produtoOferecido && (
          <div className="col-span-2">
            <span className="text-gray-500 text-xs">Produto</span>
            <p className="text-white font-medium">{dealContext.produtoOferecido}</p>
          </div>
        )}
      </div>
      {dealContext.historicalSpiced && (
        <div className="border-t border-gray-800 pt-2">
          <span className="text-gray-500 text-xs">SPICED histórico (última call)</span>
          <p className="text-white font-bold text-lg mt-1">
            {dealContext.historicalSpiced.total ?? '—'}/30
          </p>
        </div>
      )}
    </div>
  )
}
