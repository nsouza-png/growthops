// build-analysis-prompt.ts
// Builds the per-chunk dynamic context injected into Gemini `contents` (not systemInstruction).
// Keeping dynamic context in `contents` ensures the static `LIVE_CALL_SYSTEM_PROMPT` prefix
// is bit-for-bit identical across all calls in a session — enabling Gemini's implicit caching.

import type { SpicedScores } from '../types/live-call.types'

export interface AnalysisContext {
  chunkNumber:         number
  fullTranscriptSoFar: string
  spicedScoresSoFar:   SpicedScores
}

export function buildAnalysisPrompt(ctx: AnalysisContext): string {
  const scoresFormatted = Object.entries(ctx.spicedScoresSoFar)
    .map(([dim, val]) => `  ${dim}: ${val.score}/${val.max}`)
    .join('\n')

  return `
## Contexto da sessão ao vivo

Chunk número: ${ctx.chunkNumber}

Transcrição acumulada até agora:
${ctx.fullTranscriptSoFar.trim() || '(nenhuma transcrição ainda — este é o primeiro chunk)'}

Scores SPICED acumulados (os novos scores NÃO podem ser MENORES que estes):
${scoresFormatted}

## Tarefa

Analise o áudio deste chunk (parte ${ctx.chunkNumber} da sessão).
Foco: o que o CLIENTE (buyer) está dizendo.
Retorne JSON válido conforme o LiveChunkAnalysis schema definido no system prompt.
`.trim()
}
