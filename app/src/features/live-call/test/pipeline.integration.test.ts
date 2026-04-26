import { describe, it, expect } from 'vitest'
import { liveCallReducer, INITIAL_STATE } from '../store/liveCallStore'
import type { LiveChunkAnalysis } from '../types/live-call.types'

// Test the reducer directly as a pipeline validation (no need for renderHook in all tests)
// The integration test validates that:
// 1. A valid LiveChunkAnalysis payload flows correctly into the store
// 2. Score accumulation works across multiple chunks
// 3. The full state after 2 analysis cycles is correct

describe('Live Call Pipeline Integration', () => {
  const chunk1: LiveChunkAnalysis & { seq: number } = {
    seq: 1,
    transcript_chunk: 'Cliente mencionou problemas de integração com ERP.',
    suggested_question: 'Qual o impacto financeiro desse problema de integração?',
    active_spiced_dimension: 'pain',
    spiced_scores: {
      situation:      { score: 3, max: 5 },
      pain:           { score: 4, max: 5 },
      impact:         { score: 0, max: 5 },
      critical_event: { score: 0, max: 5 },
      decision:       { score: 0, max: 5 },
      delivery:       { score: 0, max: 5 },
    },
    signals: [
      {
        signal_id: 'sig-001',
        framework: 'SPICED',
        dimension: 'pain',
        polarity: 'POSITIVE',
        intensity: 3,
        excerpt: 'problemas de integração',
      },
    ],
    red_flags: [],
  }

  const chunk2: LiveChunkAnalysis & { seq: number } = {
    seq: 2,
    transcript_chunk: 'Vencimento do contrato atual em 3 meses.',
    suggested_question: 'O que acontece se não resolverem antes do vencimento?',
    active_spiced_dimension: 'critical_event',
    spiced_scores: {
      situation:      { score: 2, max: 5 }, // lower than chunk1 — should NOT decrease
      pain:           { score: 5, max: 5 }, // higher — should update
      impact:         { score: 3, max: 5 },
      critical_event: { score: 4, max: 5 },
      decision:       { score: 0, max: 5 },
      delivery:       { score: 0, max: 5 },
    },
    signals: [
      {
        signal_id: 'sig-002',
        framework: 'SPICED',
        dimension: 'critical_event',
        polarity: 'POSITIVE',
        intensity: 3,
        excerpt: 'vencimento do contrato',
      },
    ],
    red_flags: [
      {
        flag: 'contract_expiry',
        severity: 'warning',
        description: 'Contrato vencendo em 3 meses — janela de decisão curta',
      },
    ],
  }

  it('full pipeline: IDLE → ANALYZING → LISTENING after one chunk', () => {
    let state = INITIAL_STATE

    // Reach ANALYZING
    state = liveCallReducer(state, { type: 'START_CAPTURE' })
    state = liveCallReducer(state, { type: 'PERMISSION_GRANTED' })
    state = liveCallReducer(state, { type: 'VAD_SPEECH_DETECTED' })
    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    expect(state.phase).toBe('ANALYZING')

    // Dispatch analysis result
    state = liveCallReducer(state, { type: 'ANALYSIS_COMPLETE', payload: chunk1 })

    expect(state.phase).toBe('LISTENING')
    expect(state.chunkCount).toBe(1)
    expect(state.transcript).toContain(chunk1.transcript_chunk)
    expect(state.suggestedQuestion).toBe(chunk1.suggested_question)
    expect(state.spicedScores.pain.score).toBe(4)
    expect(state.spicedScores.situation.score).toBe(3)
  })

  it('score monotonicity across 2 chunks: situation stays at 3 (Math.max)', () => {
    let state = INITIAL_STATE

    // First chunk
    state = liveCallReducer(state, { type: 'START_CAPTURE' })
    state = liveCallReducer(state, { type: 'PERMISSION_GRANTED' })
    state = liveCallReducer(state, { type: 'VAD_SPEECH_DETECTED' })
    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    state = liveCallReducer(state, { type: 'ANALYSIS_COMPLETE', payload: chunk1 })

    // Second chunk
    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    state = liveCallReducer(state, { type: 'ANALYSIS_COMPLETE', payload: chunk2 })

    expect(state.chunkCount).toBe(2)
    // situation: chunk1=3, chunk2=2 → must stay 3
    expect(state.spicedScores.situation.score).toBe(3)
    // pain: chunk1=4, chunk2=5 → must update to 5
    expect(state.spicedScores.pain.score).toBe(5)
    // impact: chunk1=0, chunk2=3 → must update to 3
    expect(state.spicedScores.impact.score).toBe(3)
    // critical_event: chunk1=0, chunk2=4 → must update to 4
    expect(state.spicedScores.critical_event.score).toBe(4)
  })

  it('signals and red_flags accumulate across chunks', () => {
    let state = INITIAL_STATE

    state = liveCallReducer(state, { type: 'START_CAPTURE' })
    state = liveCallReducer(state, { type: 'PERMISSION_GRANTED' })
    state = liveCallReducer(state, { type: 'VAD_SPEECH_DETECTED' })
    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    state = liveCallReducer(state, { type: 'ANALYSIS_COMPLETE', payload: chunk1 })
    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    state = liveCallReducer(state, { type: 'ANALYSIS_COMPLETE', payload: chunk2 })

    // Signals from both chunks should be present
    expect(state.signals.length).toBeGreaterThanOrEqual(2)
    // Red flags from chunk2
    expect(state.redFlags.length).toBeGreaterThanOrEqual(1)
    expect(state.redFlags[state.redFlags.length - 1].flag).toBe('contract_expiry')
  })

  it('transcript accumulates across chunks', () => {
    let state = INITIAL_STATE

    state = liveCallReducer(state, { type: 'START_CAPTURE' })
    state = liveCallReducer(state, { type: 'PERMISSION_GRANTED' })
    state = liveCallReducer(state, { type: 'VAD_SPEECH_DETECTED' })
    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    state = liveCallReducer(state, { type: 'ANALYSIS_COMPLETE', payload: chunk1 })
    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    state = liveCallReducer(state, { type: 'ANALYSIS_COMPLETE', payload: chunk2 })

    expect(state.transcript).toContain(chunk1.transcript_chunk)
    expect(state.transcript).toContain(chunk2.transcript_chunk)
  })
})
