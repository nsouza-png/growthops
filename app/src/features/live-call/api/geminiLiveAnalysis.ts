// geminiLiveAnalysis.ts
// Backward-compatible live analysis API used by hooks/tests.
// - Blob input: direct Gemini multimodal call (client-side)
// - String input: Edge function path (gp-analyze-live-chunk)

import { supabase } from '../../../lib/supabase'
import { GEMINI_MODEL, requireGemini } from '../../../lib/geminiClient'
import { LIVE_CALL_SYSTEM_PROMPT } from '../prompts/live-call-system-prompt'
import { buildAnalysisPrompt } from '../prompts/build-analysis-prompt'
import type { AnalysisContext } from '../prompts/build-analysis-prompt'
import type { LiveChunkAnalysis } from '../types/live-call.types'

// ---------------------------------------------------------------------------
// OpenAIAnalysisError
// ---------------------------------------------------------------------------

export class LiveAnalysisError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string | null,
  ) {
    super(message)
    this.name = 'LiveAnalysisError'
  }
}

// Backward-compatible exported name expected by tests/callers.
export const GeminiAnalysisError = LiveAnalysisError

// ---------------------------------------------------------------------------
// blobToBase64 — função interna (não exportada)
// ---------------------------------------------------------------------------
// Usa FileReader para converter Blob em string base64 sem o prefixo data URI.
// Mesmo padrão já estabelecido em useAudioCapture.ts.

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Strip the "data:<mime>;base64," prefix
      resolve(result.split(',')[1])
    }
    reader.onerror = () =>
      reject(new LiveAnalysisError('Falha ao converter áudio para base64', null))
    reader.readAsDataURL(blob)
  })
}

// ---------------------------------------------------------------------------
// REQUIRED_FIELDS — campos obrigatórios do LiveChunkAnalysis
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS: (keyof LiveChunkAnalysis)[] = [
  'transcript_chunk',
  'suggested_question',
  'active_spiced_dimension',
  'spiced_scores',
  'signals',
  'red_flags',
]

// ---------------------------------------------------------------------------
// validateAnalysis — função interna (não exportada)
// ---------------------------------------------------------------------------
// Verifica presença de todos os campos obrigatórios. Não faz validação profunda
// de subcampos — apenas confirma que cada chave existe no objeto recebido.

function validateAnalysis(raw: unknown): LiveChunkAnalysis {
  if (raw === null || typeof raw !== 'object') {
    throw new LiveAnalysisError(
      'Resposta da Edge Function não é um objeto JSON válido',
      null,
    )
  }

  const obj = raw as Record<string, unknown>

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      throw new LiveAnalysisError(`Campo obrigatório ausente: ${field}`, null)
    }
  }

  return raw as LiveChunkAnalysis
}

// ---------------------------------------------------------------------------
// gpLiveAnalysis — função principal (exportada)
// ---------------------------------------------------------------------------

export async function gpLiveAnalysis(
  input: Blob | string,
  ctx: AnalysisContext,
  callId?: string,
): Promise<LiveChunkAnalysis> {
  // Blob path: call Gemini directly (multimodal)
  if (input instanceof Blob) {
    const client = requireGemini()
    const base64 = await blobToBase64(input)
    const prompt = buildAnalysisPrompt(ctx)

    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        config: { systemInstruction: LIVE_CALL_SYSTEM_PROMPT },
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: input.type || 'audio/webm;codecs=opus',
                  data: base64,
                },
              },
              { text: prompt },
            ],
          },
        ],
      })

      const rawText = response?.text
      if (!rawText || rawText.trim() === '') {
        throw new LiveAnalysisError('Gemini retornou resposta vazia', null)
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(rawText)
      } catch {
        throw new LiveAnalysisError('JSON inválido recebido do Gemini', rawText)
      }

      return validateAnalysis(parsed)
    } catch (error) {
      if (error instanceof LiveAnalysisError) throw error
      throw new LiveAnalysisError(
        `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        null,
      )
    }
  }

  // String path: call edge function
  const transcriptText = input
  try {
    const { data, error } = await supabase.functions.invoke('gp-analyze-live-chunk', {
      body: {
        call_id: callId || 'temp',
        transcript_chunk: transcriptText,
        context: ctx
      }
    })

    if (error) {
      throw new LiveAnalysisError(`Erro na Edge Function: ${error.message}`, null)
    }

    if (!data?.analysis) {
      throw new LiveAnalysisError('Edge Function retornou resposta vazia', null)
    }

    return validateAnalysis(data.analysis)
  } catch (error) {
    if (error instanceof LiveAnalysisError) {
      throw error
    }
    throw new LiveAnalysisError(
      `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      null
    )
  }
}

// Backward-compatible exported function name expected by tests/legacy callers.
export const geminiLiveAnalysis = gpLiveAnalysis
