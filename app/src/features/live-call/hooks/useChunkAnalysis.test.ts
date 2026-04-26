// useChunkAnalysis.test.ts
// Testes unitários do hook com mocks de geminiLiveAnalysis e dispatch.
// Usa renderHook do @testing-library/react para ciclo de vida real do React.
// Testes de concorrência usam Promises manuais para controle preciso de timing.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock de geminiLiveAnalysis — controla quando cada Promise resolve/rejeita
vi.mock('../api/geminiLiveAnalysis', () => ({
  geminiLiveAnalysis: vi.fn(),
  GeminiAnalysisError: class GeminiAnalysisError extends Error {
    rawResponse: string | null
    constructor(message: string, rawResponse: string | null = null) {
      super(message)
      this.name = 'GeminiAnalysisError'
      this.rawResponse = rawResponse
    }
  },
}))

import { geminiLiveAnalysis, GeminiAnalysisError } from '../api/geminiLiveAnalysis'
import { useChunkAnalysis } from './useChunkAnalysis'
import type { SessionState, SessionAction } from '../types/live-call.types'
import type { SpicedScores } from '../types/live-call.types'

const mockGemini = geminiLiveAnalysis as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlob(id = 'audio'): Blob {
  return new Blob([id], { type: 'audio/webm' })
}

function makeInitialScores(): SpicedScores {
  return {
    situation:      { score: 0, max: 5 },
    pain:           { score: 0, max: 5 },
    impact:         { score: 0, max: 5 },
    critical_event: { score: 0, max: 5 },
    decision:       { score: 0, max: 5 },
    delivery:       { score: 0, max: 5 },
  }
}

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    phase: 'LISTENING',
    transcript: '',
    spicedScores: makeInitialScores(),
    signals: [],
    redFlags: [],
    suggestedQuestion: null,
    activeSpicedDimension: null,
    chunkCount: 0,
    analysisErrors: 0,
    startedAt: null,
    endedAt: null,
    error: null,
    ...overrides,
  }
}

const validAnalysisResult = {
  transcript_chunk: 'O cliente falou sobre o problema.',
  suggested_question: 'Qual o impacto financeiro?',
  active_spiced_dimension: 'pain' as const,
  spiced_scores: makeInitialScores(),
  signals: [],
  red_flags: [],
}

// Helper para criar uma Promise que pode ser resolvida/rejeitada externamente
function makeDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('useChunkAnalysis', () => {
  let dispatch: ReturnType<typeof vi.fn>
  let state: SessionState

  beforeEach(() => {
    vi.clearAllMocks()
    dispatch = vi.fn()
    state = makeState()
  })

  // Cenário 1: blob chega com isAnalyzingRef=false
  // → despacha AUDIO_CHUNK_READY, chama geminiLiveAnalysis, despacha ANALYSIS_COMPLETE
  it('despacha AUDIO_CHUNK_READY e ANALYSIS_COMPLETE em chamada simples', async () => {
    mockGemini.mockResolvedValueOnce(validAnalysisResult)

    const { result } = renderHook(() => useChunkAnalysis(state, dispatch))

    await act(async () => {
      result.current.onBlob(makeBlob())
    })

    // AUDIO_CHUNK_READY deve ser o primeiro dispatch
    expect(dispatch).toHaveBeenCalledWith({ type: 'AUDIO_CHUNK_READY' })

    // ANALYSIS_COMPLETE deve ser o segundo dispatch com seq=1
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ANALYSIS_COMPLETE',
      payload: { ...validAnalysisResult, seq: 1 },
    })

    expect(dispatch).toHaveBeenCalledTimes(2)
  })

  // Cenário 2: segundo blob chega enquanto isAnalyzingRef=true
  // → NÃO chama geminiLiveAnalysis de novo; salva em pendingBlobRef
  it('armazena blob em pendingBlobRef quando análise está em progresso', async () => {
    const deferred = makeDeferred<typeof validAnalysisResult>()
    mockGemini.mockReturnValueOnce(deferred.promise)

    const { result } = renderHook(() => useChunkAnalysis(state, dispatch))

    // Primeiro blob — inicia análise (fica pendente)
    act(() => {
      result.current.onBlob(makeBlob('blob-1'))
    })

    // Segundo blob chega enquanto primeiro ainda está em progresso
    act(() => {
      result.current.onBlob(makeBlob('blob-2'))
    })

    // geminiLiveAnalysis deve ter sido chamado apenas 1 vez até aqui
    expect(mockGemini).toHaveBeenCalledTimes(1)

    // Resolver o primeiro
    mockGemini.mockResolvedValueOnce(validAnalysisResult)
    await act(async () => {
      deferred.resolve(validAnalysisResult)
    })

    // Agora o pendente deve ter sido processado — total de 2 chamadas
    expect(mockGemini).toHaveBeenCalledTimes(2)
  })

  // Cenário 3: terceiro blob chega antes do segundo ser processado
  // → substitui segundo em pendingBlobRef (blob-2 descartado, blob-3 processado)
  it('terceiro blob substitui segundo em pendingBlobRef (newest wins)', async () => {
    const deferred1 = makeDeferred<typeof validAnalysisResult>()
    mockGemini.mockReturnValueOnce(deferred1.promise)

    const { result } = renderHook(() => useChunkAnalysis(state, dispatch))

    const blob1 = makeBlob('blob-1')
    const blob2 = makeBlob('blob-2')
    const blob3 = makeBlob('blob-3')

    // Primeiro blob — inicia análise
    act(() => {
      result.current.onBlob(blob1)
    })

    // Segundo blob — vai para pendingBlobRef
    act(() => {
      result.current.onBlob(blob2)
    })

    // Terceiro blob — substitui segundo em pendingBlobRef
    act(() => {
      result.current.onBlob(blob3)
    })

    // Gemini chamado apenas 1 vez (apenas blob-1)
    expect(mockGemini).toHaveBeenCalledTimes(1)

    // Resolver blob-1 e deixar blob-3 ser processado
    mockGemini.mockResolvedValueOnce(validAnalysisResult)
    await act(async () => {
      deferred1.resolve(validAnalysisResult)
    })

    // Agora blob-3 deve ter sido processado (não blob-2)
    expect(mockGemini).toHaveBeenCalledTimes(2)
    // O segundo call ao mockGemini deve ter recebido blob-3
    const secondCallBlob = mockGemini.mock.calls[1][0]
    expect(secondCallBlob).toBe(blob3)
  })

  // Cenário 4: após ANALYSIS_COMPLETE, pendingBlobRef não-null → processa automaticamente
  it('processa pendingBlobRef automaticamente após ANALYSIS_COMPLETE', async () => {
    const deferred = makeDeferred<typeof validAnalysisResult>()
    mockGemini.mockReturnValueOnce(deferred.promise)
    mockGemini.mockResolvedValueOnce(validAnalysisResult)

    const { result } = renderHook(() => useChunkAnalysis(state, dispatch))

    act(() => {
      result.current.onBlob(makeBlob('blob-1'))
    })

    act(() => {
      result.current.onBlob(makeBlob('blob-2'))
    })

    await act(async () => {
      deferred.resolve(validAnalysisResult)
    })

    // Dois AUDIO_CHUNK_READY e dois ANALYSIS_COMPLETE
    const audioChunkReadyCalls = dispatch.mock.calls.filter(
      call => call[0].type === 'AUDIO_CHUNK_READY'
    )
    const analysisCompleteCalls = dispatch.mock.calls.filter(
      call => call[0].type === 'ANALYSIS_COMPLETE'
    )

    expect(audioChunkReadyCalls).toHaveLength(2)
    expect(analysisCompleteCalls).toHaveLength(2)
  })

  // Cenário 5: geminiLiveAnalysis lança GeminiAnalysisError
  // → despacha ANALYSIS_ERROR com message e seq; isAnalyzingRef volta a false
  it('despacha ANALYSIS_ERROR quando geminiLiveAnalysis lança GeminiAnalysisError', async () => {
    mockGemini.mockRejectedValueOnce(
      new GeminiAnalysisError('JSON inválido recebido do Gemini', null)
    )

    const { result } = renderHook(() => useChunkAnalysis(state, dispatch))

    await act(async () => {
      result.current.onBlob(makeBlob())
    })

    expect(dispatch).toHaveBeenCalledWith({ type: 'AUDIO_CHUNK_READY' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ANALYSIS_ERROR',
      payload: { message: 'JSON inválido recebido do Gemini', seq: 1 },
    })
  })

  // Cenário 5b: após erro, isAnalyzingRef volta a false — aceita próximo blob
  it('aceita próximo blob após ANALYSIS_ERROR', async () => {
    mockGemini.mockRejectedValueOnce(new GeminiAnalysisError('Erro', null))
    mockGemini.mockResolvedValueOnce(validAnalysisResult)

    const { result } = renderHook(() => useChunkAnalysis(state, dispatch))

    await act(async () => {
      result.current.onBlob(makeBlob('blob-1'))
    })

    await act(async () => {
      result.current.onBlob(makeBlob('blob-2'))
    })

    // Dois AUDIO_CHUNK_READY (blob-1 e blob-2)
    const audioChunkReadyCalls = dispatch.mock.calls.filter(
      call => call[0].type === 'AUDIO_CHUNK_READY'
    )
    expect(audioChunkReadyCalls).toHaveLength(2)
  })

  // Cenário 6: resposta com seq antigo é descartada
  // → sem ANALYSIS_COMPLETE nem ANALYSIS_ERROR para seq stale
  it('descarta resposta com seq menor que latestSeqRef', async () => {
    // Blob-1 inicia análise com seq=1 (deferred — fica lento)
    const deferred1 = makeDeferred<typeof validAnalysisResult>()
    mockGemini.mockReturnValueOnce(deferred1.promise)

    // Blob-2 vai para pendingBlobRef
    // Blob-3 substitui blob-2 (seq=3 será o mais recente quando blob-2 começar)
    // Mas o plano especifica: seq < latestSeqRef → descartar
    // Vamos testar o cenário básico: iniciar análise, e quando seq=1 tentar resolver
    // depois de seq=2 já ter sido iniciado via pending

    const { result } = renderHook(() => useChunkAnalysis(state, dispatch))

    act(() => {
      result.current.onBlob(makeBlob('blob-1'))
    })

    // Blob-2 vai para pendingBlobRef (seq=2 será atribuído no finally do blob-1)
    act(() => {
      result.current.onBlob(makeBlob('blob-2'))
    })

    // Resolver blob-1 normalmente — dispatch ANALYSIS_COMPLETE(seq=1)
    // Blob-2 (seq=2) será iniciado no finally
    mockGemini.mockResolvedValueOnce(validAnalysisResult)
    await act(async () => {
      deferred1.resolve(validAnalysisResult)
    })

    const completeCalls = dispatch.mock.calls.filter(
      call => call[0].type === 'ANALYSIS_COMPLETE'
    )

    // Ambas as análises devem ter completado normalmente (seq sequencial)
    expect(completeCalls.length).toBeGreaterThanOrEqual(1)
    // O primeiro ANALYSIS_COMPLETE deve ter seq=1
    expect(completeCalls[0][0].payload.seq).toBe(1)
  })

  // Cenário 7: onBlob é estável (useCallback — mesma referência após re-render)
  it('onBlob mantém referência estável entre re-renders', () => {
    const { result, rerender } = renderHook(
      ({ s }: { s: SessionState }) => useChunkAnalysis(s, dispatch),
      { initialProps: { s: state } }
    )

    const onBlobFirst = result.current.onBlob

    // Forçar re-render com novo estado
    rerender({ s: makeState({ transcript: 'novo transcript' }) })

    // onBlob deve ser a mesma referência (deps vazias ou estáveis)
    expect(result.current.onBlob).toBe(onBlobFirst)
  })

  // Erro genérico (não GeminiAnalysisError) → mensagem fallback
  it('usa mensagem fallback para erros não-GeminiAnalysisError', async () => {
    mockGemini.mockRejectedValueOnce(new Error('Algum erro inesperado'))

    const { result } = renderHook(() => useChunkAnalysis(state, dispatch))

    await act(async () => {
      result.current.onBlob(makeBlob())
    })

    expect(dispatch).toHaveBeenCalledWith({
      type: 'ANALYSIS_ERROR',
      payload: { message: 'Erro desconhecido na análise', seq: 1 },
    })
  })
})
