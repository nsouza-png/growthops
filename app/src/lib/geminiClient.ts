import { GoogleGenAI } from '@google/genai'

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined

// Graceful degradation: sem key o app carrega normalmente.
// Features que dependem do Gemini mostrarão erro apenas quando acionadas.
// Para ativar: adicione VITE_GEMINI_API_KEY nos secrets do GitHub Actions.
export const geminiClient = geminiApiKey
  ? new GoogleGenAI({ apiKey: geminiApiKey })
  : null

export const GEMINI_MODEL = 'gemini-2.5-flash' as const

/** Lança erro legível se o cliente não estiver disponível */
export function requireGemini(): GoogleGenAI {
  if (!geminiClient) {
    throw new Error('[Gemini] VITE_GEMINI_API_KEY não configurado. Adicione nos secrets do GitHub Actions.')
  }
  return geminiClient
}
