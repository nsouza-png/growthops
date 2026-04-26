// BusinessIntelPanel.tsx
// Painel de inteligência setorial: exibe contexto de negócio específico do
// segmento/faixa do deal com framing por dimensão SPICED ativa.
// Só renderiza após a primeira análise (chunkCount > 0).

import type { DealContext } from '../hooks/useDealContext'

// ---------------------------------------------------------------------------
// Framing por segmento + dimensão SPICED
// ---------------------------------------------------------------------------

function getIntelFraming(
  segmento: string | null,
  faixa: string | null,
  dimension: string | null
): string | null {
  if (!dimension || !segmento) return null

  const key = `${segmento.toLowerCase()}-${dimension}`
  const framings: Record<string, string> = {
    'educação-pain':
      'Empresas de Educação com processos de vendas manuais perdem em média 40% das oportunidades por falta de inteligência comercial.',
    'educação-impact':
      'No setor de Educação, o impacto de não resolver gera churn de alunos e queda de receita recorrente.',
    'educação-critical_event':
      'Matrículas são sazonais — datas de captação são eventos críticos inegociáveis.',
    'tecnologia-pain':
      'Em empresas de Tecnologia, o custo de oportunidade de processos manuais supera 3x o investimento na solução.',
    'tecnologia-impact':
      'Stack tecnológico fragmentado gera retrabalho e atrasa ciclos de venda.',
    'saúde-pain':
      'Processos de vendas no setor de Saúde são complexos — múltiplos stakeholders e compliance atrapalham conversão.',
  }

  return framings[key] ?? null
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BusinessIntelPanelProps {
  dealContext: DealContext | null
  activeDimension?: string | null
  chunkCount: number
}

// ---------------------------------------------------------------------------
// BusinessIntelPanel
// ---------------------------------------------------------------------------

export function BusinessIntelPanel({
  dealContext,
  activeDimension,
  chunkCount,
}: BusinessIntelPanelProps) {
  // Não renderiza enquanto não há deal ou nenhum chunk analisado
  if (!dealContext || chunkCount === 0) return null

  const framing = getIntelFraming(
    dealContext.leadSegmento,
    dealContext.leadFaixa,
    activeDimension ?? null
  )

  return (
    <div className="card-sm border border-blue-900/30 bg-blue-900/5">
      <h3 className="section-eyebrow text-blue-400 mb-2">Inteligência Setorial</h3>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-500 text-xs">Segmento</span>
          <p className="text-white">{dealContext.leadSegmento ?? '—'}</p>
        </div>
        {dealContext.leadFaixa && (
          <div>
            <span className="text-gray-500 text-xs">Faixa</span>
            <p className="text-white">{dealContext.leadFaixa}</p>
          </div>
        )}
        {framing && (
          <div className="border-t border-gray-800 pt-2">
            <span className="text-gray-500 text-xs">Contexto de negócio</span>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">{framing}</p>
          </div>
        )}
      </div>
    </div>
  )
}
