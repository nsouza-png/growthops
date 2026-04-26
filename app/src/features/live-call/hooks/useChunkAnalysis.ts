// useChunkAnalysis.ts
// Orquestração de análise de chunks de áudio com guarda de concorrência.
//
// Garante:
//   - Nunca 2 análises simultâneas (isAnalyzingRef)
//   - Blob mais recente sempre processado após análise em curso (pendingBlobRef)
//   - Respostas atrasadas descartadas sem corromper o store (latestSeqRef)
//   - Estado do store sempre atualizado para evitar closures stale (stateRef)

import { useRef, useCallback, useEffect, type Dispatch } from 'react'
import type { SessionState, SessionAction } from '../types/live-call.types'
import type { AnalysisContext } from '../prompts/build-analysis-prompt'
import { geminiLiveAnalysis, GeminiAnalysisError } from '../api/geminiLiveAnalysis'

// ---------------------------------------------------------------------------
// Tipo público do hook
// ---------------------------------------------------------------------------

export interface UseChunkAnalysisReturn {
  onBlob: (blob: Blob) => void
}

// ---------------------------------------------------------------------------
// useChunkAnalysis
// ---------------------------------------------------------------------------

export function useChunkAnalysis(
  state: SessionState,
  dispatch: Dispatch<SessionAction>,
): UseChunkAnalysisReturn {
  // Refs de concorrência — NUNCA useState (mutations não devem re-render)
  const isAnalyzingRef = useRef<boolean>(false)
  const pendingBlobRef = useRef<Blob | null>(null)
  const latestSeqRef = useRef<number>(0)

  // stateRef — evita closure stale dentro de onBlob/analyzeBlob
  const stateRef = useRef<SessionState>(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // analyzeBlob — função interna async (não exportada)
  // Parâmetros explícitos para evitar closures capturando variáveis mutáveis
  const analyzeBlob = useCallback(async (blob: Blob, seq: number) => {
    isAnalyzingRef.current = true
    dispatch({ type: 'AUDIO_CHUNK_READY' })

    try {
      const currentState = stateRef.current
      const ctx: AnalysisContext = {
        chunkNumber: currentState.chunkCount + 1,
        fullTranscriptSoFar: currentState.transcript,
        spicedScoresSoFar: currentState.spicedScores,
      }

      const result = await geminiLiveAnalysis(blob, ctx)

      // Descartar resposta atrasada — seq mais recente já está em progresso
      if (seq < latestSeqRef.current) return

      dispatch({ type: 'ANALYSIS_COMPLETE', payload: { ...result, seq } })
    } catch (err) {
      // Descartar resposta atrasada mesmo em caso de erro
      if (seq < latestSeqRef.current) return

      const message =
        err instanceof GeminiAnalysisError
          ? err.message
          : 'Erro desconhecido na análise'
      dispatch({ type: 'ANALYSIS_ERROR', payload: { message, seq } })
    } finally {
      isAnalyzingRef.current = false

      // Processar blob pendente se chegou durante esta análise
      const pending = pendingBlobRef.current
      if (pending !== null) {
        pendingBlobRef.current = null
        latestSeqRef.current += 1
        // Chamada recursiva segura — isAnalyzingRef já voltou para false
        void analyzeBlob(pending, latestSeqRef.current)
      }
    }
  }, [dispatch]) // dispatch é estável; dependências de state via stateRef

  // onBlob — API pública do hook
  // deps vazias: usa apenas refs (mutáveis, não causam re-render)
  const onBlob = useCallback((blob: Blob) => {
    if (isAnalyzingRef.current) {
      // Substituição — sem fila crescente (newest wins)
      pendingBlobRef.current = blob
      return
    }

    latestSeqRef.current += 1
    void analyzeBlob(blob, latestSeqRef.current)
  }, [analyzeBlob])

  return { onBlob }
}
