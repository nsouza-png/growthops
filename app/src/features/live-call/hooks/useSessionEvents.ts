// useSessionEvents.ts
// Observa eventos do MediaStreamTrack de áudio e despacha ações de sessão
// correspondentes para o liveCallStore.
//
// Responsabilidades:
//   - Detectar VAD (voice activity) via AudioContext/AnalyserNode e despachar VAD_SPEECH_DETECTED
//   - Detectar pausa de sessão (tab em segundo plano via Page Visibility API) e notificar consumidor
//   - Limpar listeners ao desmontar ou ao trocar de track

import { useEffect, useRef, type Dispatch } from 'react'
import type { SessionAction } from '../types/live-call.types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface UseSessionEventsOptions {
  /** O MediaStreamTrack de áudio ativo; null enquanto não capturando. */
  audioTrack: MediaStreamTrack | null
  /** Dispatch do liveCallStore para emitir ações de estado. */
  dispatch: Dispatch<SessionAction>
  /** Callback chamado quando a visibilidade da aba muda (true = pausado). */
  onPauseChange?: (paused: boolean) => void
}

// ---------------------------------------------------------------------------
// Constantes de VAD
// ---------------------------------------------------------------------------

/** RMS mínimo para considerar que há fala (ajustável conforme ambiente). */
const VAD_RMS_THRESHOLD = 0.01
/** Intervalo de análise em ms — equilíbrio entre responsividade e CPU. */
const VAD_POLL_INTERVAL_MS = 500

// ---------------------------------------------------------------------------
// useSessionEvents
// ---------------------------------------------------------------------------

export function useSessionEvents({
  audioTrack,
  dispatch,
  onPauseChange,
}: UseSessionEventsOptions): void {
  // Ref para controlar se VAD já foi disparado nesta sessão
  // (evitar despachar VAD_SPEECH_DETECTED múltiplas vezes — só importa a primeira)
  const vadFiredRef = useRef<boolean>(false)

  // Ref para o timer de polling VAD
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Ref para AudioContext criado pelo VAD (deve ser fechado ao cleanup)
  const vadAudioCtxRef = useRef<AudioContext | null>(null)

  // ---- Page Visibility API ----
  useEffect(() => {
    if (!onPauseChange) return

    const handleVisibilityChange = () => {
      onPauseChange(document.visibilityState === 'hidden')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [onPauseChange])

  // ---- VAD via AnalyserNode ----
  useEffect(() => {
    // Sem track ativo: limpar qualquer análise anterior
    if (!audioTrack) {
      vadFiredRef.current = false
      if (vadTimerRef.current !== null) {
        clearInterval(vadTimerRef.current)
        vadTimerRef.current = null
      }
      if (vadAudioCtxRef.current && vadAudioCtxRef.current.state !== 'closed') {
        vadAudioCtxRef.current.close()
        vadAudioCtxRef.current = null
      }
      return
    }

    // Reseta o flag VAD para a nova sessão de captura
    vadFiredRef.current = false

    let cancelled = false

    async function startVAD() {
      try {
        // Criar AudioContext e AnalyserNode a partir do track
        const audioCtx = new AudioContext()
        vadAudioCtxRef.current = audioCtx

        const stream = new MediaStream([audioTrack!])
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)

        const buffer = new Float32Array(analyser.fftSize)

        vadTimerRef.current = setInterval(() => {
          if (cancelled || vadFiredRef.current) return

          analyser.getFloatTimeDomainData(buffer)

          // Calcula RMS (root mean square) do buffer
          let sumSq = 0
          for (let i = 0; i < buffer.length; i++) {
            sumSq += buffer[i] * buffer[i]
          }
          const rms = Math.sqrt(sumSq / buffer.length)

          if (rms > VAD_RMS_THRESHOLD) {
            vadFiredRef.current = true
            dispatch({ type: 'VAD_SPEECH_DETECTED' })
          }
        }, VAD_POLL_INTERVAL_MS)
      } catch {
        // VAD não é crítico — falha silenciosa; sessão continua sem detecção de fala
      }
    }

    void startVAD()

    return () => {
      cancelled = true
      if (vadTimerRef.current !== null) {
        clearInterval(vadTimerRef.current)
        vadTimerRef.current = null
      }
      if (vadAudioCtxRef.current && vadAudioCtxRef.current.state !== 'closed') {
        vadAudioCtxRef.current.close()
        vadAudioCtxRef.current = null
      }
    }
  }, [audioTrack, dispatch])
}
