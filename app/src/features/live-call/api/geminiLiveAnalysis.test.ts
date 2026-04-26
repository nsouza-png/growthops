// geminiLiveAnalysis.test.ts
// Testes unitários com mock de geminiClient e FileReader.
// Cada teste é isolado — vi.clearAllMocks() no beforeEach.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures this runs before vi.mock factories (which are hoisted)
const { mockGenerateContentFn } = vi.hoisted(() => ({
  mockGenerateContentFn: vi.fn(),
}))

vi.mock('../../../lib/geminiClient', () => ({
  geminiClient: {
    models: { generateContent: mockGenerateContentFn },
  },
  requireGemini: () => ({
    models: { generateContent: mockGenerateContentFn },
  }),
  GEMINI_MODEL: 'gemini-2.5-flash',
}))

// Mockar system prompt para evitar o long string nos snapshots de teste
vi.mock('../prompts/live-call-system-prompt', () => ({
  LIVE_CALL_SYSTEM_PROMPT: 'test system prompt',
}))

import { geminiClient } from '../../../lib/geminiClient'
import { geminiLiveAnalysis, GeminiAnalysisError } from './geminiLiveAnalysis'
import type { AnalysisContext } from '../prompts/build-analysis-prompt'

// ---------------------------------------------------------------------------
// Mock do FileReader global
// ---------------------------------------------------------------------------
// jsdom não implementa FileReader.readAsDataURL de forma funcional.
// Simulamos o comportamento: readAsDataURL chama onloadend com um data URI fake.

function makeFileReaderMock(base64Result: string, shouldError = false) {
  return class MockFileReader {
    result: string | null = null
    onloadend: (() => void) | null = null
    onerror: (() => void) | null = null

    readAsDataURL(_blob: Blob) {
      if (shouldError) {
        setTimeout(() => {
          if (this.onerror) this.onerror()
        }, 0)
      } else {
        this.result = `data:audio/webm;base64,${base64Result}`
        setTimeout(() => {
          if (this.onloadend) this.onloadend()
        }, 0)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockGenerateContent = mockGenerateContentFn as ReturnType<typeof vi.fn>

function makeBlob(content = 'fake audio data'): Blob {
  return new Blob([content], { type: 'audio/webm;codecs=opus' })
}

const mockContext: AnalysisContext = {
  chunkNumber: 1,
  fullTranscriptSoFar: '',
  spicedScoresSoFar: {
    situation:      { score: 0, max: 5 },
    pain:           { score: 0, max: 5 },
    impact:         { score: 0, max: 5 },
    critical_event: { score: 0, max: 5 },
    decision:       { score: 0, max: 5 },
    delivery:       { score: 0, max: 5 },
  },
}

const validAnalysis = {
  transcript_chunk: 'O cliente mencionou dificuldades com o processo atual.',
  suggested_question: 'Qual o impacto financeiro desse problema?',
  active_spiced_dimension: 'pain',
  spiced_scores: {
    situation:      { score: 2, max: 5 },
    pain:           { score: 3, max: 5 },
    impact:         { score: 0, max: 5 },
    critical_event: { score: 0, max: 5 },
    decision:       { score: 0, max: 5 },
    delivery:       { score: 0, max: 5 },
  },
  signals: [
    {
      signal_id: 'SPICED_PAIN_01',
      framework: 'SPICED',
      dimension: 'pain',
      polarity: 'POSITIVE',
      intensity: 2,
      excerpt: 'dificuldades com o processo atual',
    },
  ],
  red_flags: [],
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('geminiLiveAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Stub FileReader padrão: retorna base64 fake sem erro
    vi.stubGlobal('FileReader', makeFileReaderMock('ZmFrZWF1ZGlv'))
  })

  // Cenário 1: resposta válida → retorna LiveChunkAnalysis completo
  it('retorna LiveChunkAnalysis parsado em resposta JSON válida', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(validAnalysis),
    })

    const result = await geminiLiveAnalysis(makeBlob(), mockContext)

    expect(result.transcript_chunk).toBe(validAnalysis.transcript_chunk)
    expect(result.suggested_question).toBe(validAnalysis.suggested_question)
    expect(result.active_spiced_dimension).toBe('pain')
    expect(result.spiced_scores.pain.score).toBe(3)
    expect(result.signals).toHaveLength(1)
    expect(result.red_flags).toHaveLength(0)
  })

  // Cenário 2: JSON inválido → GeminiAnalysisError com message adequada
  it('lança GeminiAnalysisError em JSON inválido', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'not valid json { broken',
    })

    let caught: unknown
    try {
      await geminiLiveAnalysis(makeBlob(), mockContext)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(GeminiAnalysisError)
    expect((caught as InstanceType<typeof GeminiAnalysisError>).message).toContain('JSON inválido recebido do Gemini')
  })

  // Cenário 3: campo obrigatório ausente → GeminiAnalysisError com campo faltante
  it('lança GeminiAnalysisError quando campo obrigatório está ausente', async () => {
    const incomplete = { ...validAnalysis }
    delete (incomplete as Record<string, unknown>).suggested_question
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(incomplete),
    })

    let caught: unknown
    try {
      await geminiLiveAnalysis(makeBlob(), mockContext)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(GeminiAnalysisError)
    expect((caught as InstanceType<typeof GeminiAnalysisError>).message).toContain('Campo obrigatório ausente: suggested_question')
  })

  // Cenário 4: response.text é null/undefined → GeminiAnalysisError "resposta vazia"
  it('lança GeminiAnalysisError quando Gemini retorna resposta vazia', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: null })

    let caught: unknown
    try {
      await geminiLiveAnalysis(makeBlob(), mockContext)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(GeminiAnalysisError)
    expect((caught as InstanceType<typeof GeminiAnalysisError>).message).toContain('Gemini retornou resposta vazia')
  })

  // Cenário 5: blobToBase64 usa FileReader — base64 sem prefixo data URI
  it('passa base64 sem prefixo data URI para o Gemini', async () => {
    const expectedBase64 = 'ZmFrZWF1ZGlv'
    vi.stubGlobal('FileReader', makeFileReaderMock(expectedBase64))

    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(validAnalysis) })

    await geminiLiveAnalysis(makeBlob(), mockContext)

    const callArgs = mockGenerateContent.mock.calls[0][0]
    const inlineData = callArgs.contents[0].parts[0].inlineData
    expect(inlineData.data).toBe(expectedBase64)
    expect(inlineData.data).not.toContain('data:')
    expect(inlineData.data).not.toContain('base64,')
  })

  // Verificar mime type correto
  it('usa mime type audio/webm;codecs=opus no inlineData', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(validAnalysis) })

    await geminiLiveAnalysis(makeBlob(), mockContext)

    const callArgs = mockGenerateContent.mock.calls[0][0]
    const inlineData = callArgs.contents[0].parts[0].inlineData
    expect(inlineData.mimeType).toBe('audio/webm;codecs=opus')
  })

  // GeminiAnalysisError expõe rawResponse no erro de JSON
  it('expõe rawResponse no GeminiAnalysisError de JSON inválido', async () => {
    const rawText = 'malformed {{ json'
    mockGenerateContent.mockResolvedValueOnce({ text: rawText })

    try {
      await geminiLiveAnalysis(makeBlob(), mockContext)
      expect.fail('deveria ter lançado erro')
    } catch (e) {
      expect(e).toBeInstanceOf(GeminiAnalysisError)
      expect((e as InstanceType<typeof GeminiAnalysisError>).rawResponse).toBe(rawText)
    }
  })

  // FileReader com erro → GeminiAnalysisError
  it('lança GeminiAnalysisError quando FileReader falha', async () => {
    vi.stubGlobal('FileReader', makeFileReaderMock('', true))

    let caught: unknown
    try {
      await geminiLiveAnalysis(makeBlob(), mockContext)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(GeminiAnalysisError)
    expect((caught as InstanceType<typeof GeminiAnalysisError>).message).toContain('Falha ao converter áudio para base64')
  })

  // Verifica que systemInstruction é o LIVE_CALL_SYSTEM_PROMPT
  it('usa LIVE_CALL_SYSTEM_PROMPT como systemInstruction', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(validAnalysis) })

    await geminiLiveAnalysis(makeBlob(), mockContext)

    const callArgs = mockGenerateContent.mock.calls[0][0]
    expect(callArgs.config.systemInstruction).toBe('test system prompt')
  })

  // Verifica que response.text string vazia também é tratada como vazia
  it('lança GeminiAnalysisError quando response.text é string vazia', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: '' })

    let caught: unknown
    try {
      await geminiLiveAnalysis(makeBlob(), mockContext)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(GeminiAnalysisError)
    expect((caught as InstanceType<typeof GeminiAnalysisError>).message).toContain('Gemini retornou resposta vazia')
  })
})
