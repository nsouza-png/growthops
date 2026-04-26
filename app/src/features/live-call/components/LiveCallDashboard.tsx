// LiveCallDashboard.tsx
// Orquestrador principal do painel de inteligência de call ao vivo.
// Conecta captura de áudio, análise de chunks, store de estado e todos os sub-painéis.

import { useState } from 'react'
import { useLiveCallStore } from '../store/liveCallStore'
import { useChunkAnalysis } from '../hooks/useChunkAnalysis'
import { useDealContext } from '../hooks/useDealContext'
import { useSessionEvents } from '../hooks/useSessionEvents'
import { SpicedScoreBar } from './SpicedScoreBar'
import { TalkRatioGauge } from './TalkRatioGauge'
import { DealContextPanel } from './DealContextPanel'
import { SuggestedQuestionCard } from './SuggestedQuestionCard'
import { SignalFeed } from './SignalFeed'
import { BusinessIntelPanel } from './BusinessIntelPanel'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LiveCallDashboardProps {
  dealId?: string
}

// ---------------------------------------------------------------------------
// LiveCallDashboard
// ---------------------------------------------------------------------------

export function LiveCallDashboard({ dealId }: LiveCallDashboardProps) {
  const { state, dispatch } = useLiveCallStore()
  const { onBlob: _onBlob } = useChunkAnalysis(state, dispatch)
  const { context: dealContext } = useDealContext(dealId)
  const [isPaused, setIsPaused] = useState(false)

  useSessionEvents({
    audioTrack: null,
    dispatch,
    onPauseChange: setIsPaused,
  })

  const startCapture = () => {}
  const stopCapture = () => {}
  const isCapturing = state.phase === 'LISTENING' || state.phase === 'ANALYZING'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="section-eyebrow">LIVE CALL</span>
          <h1 className="text-2xl font-bold text-white mt-1">Sessão ao Vivo</h1>
          <p className="text-gray-400 text-sm mt-1">
            {dealContext?.leadPerfil ?? 'Nenhum deal selecionado'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isCapturing && (
            <div className="flex items-center gap-2 text-sm text-g4-red">
              <span className="w-2 h-2 rounded-full bg-g4-red animate-pulse" />
              Capturando
            </div>
          )}
          {isPaused && (
            <span className="text-xs text-yellow-400">Pausado (aba em segundo plano)</span>
          )}
          {!isCapturing ? (
            <button className="btn-primary" onClick={startCapture}>
              Iniciar Captura
            </button>
          ) : (
            <button className="btn-ghost" onClick={stopCapture}>
              Encerrar
            </button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coluna esquerda: contexto do deal + SPICED scores */}
        <div className="space-y-4">
          {dealContext && <DealContextPanel dealContext={dealContext} />}
          <div className="card-sm">
            <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
              SPICED Score
            </h3>
            <SpicedScoreBar
              scores={state.spicedScores}
              activeDimension={state.activeSpicedDimension}
            />
          </div>
          {state.talkRatioCloser != null && (
            <TalkRatioGauge talkRatioCloser={state.talkRatioCloser} />
          )}
        </div>

        {/* Coluna central: pergunta sugerida + transcrição */}
        <div className="space-y-4">
          <SuggestedQuestionCard
            question={state.suggestedQuestion}
            activeDimension={state.activeSpicedDimension}
            chunkCount={state.chunkCount}
          />
          {state.transcript && (
            <div className="card-sm">
              <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Transcrição
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">{state.transcript}</p>
            </div>
          )}
        </div>

        {/* Coluna direita: sinais + inteligência setorial */}
        <div className="space-y-4">
          <SignalFeed
            signals={state.signals}
            redFlags={state.redFlags}
          />
          <BusinessIntelPanel
            dealContext={dealContext}
            activeDimension={state.activeSpicedDimension}
            chunkCount={state.chunkCount}
          />
        </div>
      </div>
    </div>
  )
}
