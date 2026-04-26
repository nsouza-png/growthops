// SuggestedQuestionCard.tsx
// Exibe a pergunta sugerida pela IA para a dimensão SPICED ativa.
// Mostra estado vazio enquanto aguarda a primeira análise.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIMENSION_LABELS: Record<string, string> = {
  situation:      'Situação',
  pain:           'Dor',
  impact:         'Impacto',
  critical_event: 'Evento Crítico',
  decision:       'Decisão',
  delivery:       'Entrega',
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SuggestedQuestionCardProps {
  question: string | null
  activeDimension?: string | null
  chunkCount: number
}

// ---------------------------------------------------------------------------
// SuggestedQuestionCard
// ---------------------------------------------------------------------------

export function SuggestedQuestionCard({
  question,
  activeDimension,
  chunkCount,
}: SuggestedQuestionCardProps) {
  if (!question) {
    return (
      <div className="card-sm flex flex-col items-center justify-center py-8 text-center">
        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center mb-3">
          <span className="text-gray-500 text-lg">?</span>
        </div>
        <p className="text-gray-500 text-sm">
          {chunkCount === 0
            ? 'Inicie a captura para receber perguntas sugeridas'
            : 'Analisando...'}
        </p>
      </div>
    )
  }

  return (
    <div className="card-sm border border-g4-red/30 bg-g4-red/5">
      <div className="flex items-center justify-between mb-2">
        <span className="section-eyebrow text-g4-red">Pergunta Sugerida</span>
        {activeDimension && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
            {DIMENSION_LABELS[activeDimension] ?? activeDimension}
          </span>
        )}
      </div>
      <p className="text-white font-medium text-base leading-relaxed">{question}</p>
    </div>
  )
}
