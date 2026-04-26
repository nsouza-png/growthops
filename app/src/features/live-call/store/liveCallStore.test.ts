import { describe, it, expect } from 'vitest'
import { INITIAL_STATE, liveCallReducer } from './liveCallStore'
import type { SessionState } from '../types/live-call.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnalysisPayload(scores: Partial<Record<string, number>>, seq = 1) {
  const baseScore = (n: number) => ({ score: n, max: 5 as const })
  return {
    seq,
    transcript_chunk: 'test chunk',
    suggested_question: 'pergunta teste?',
    active_spiced_dimension: 'pain' as const,
    signals: [],
    red_flags: [],
    spiced_scores: {
      situation:      baseScore(scores.situation      ?? 0),
      pain:           baseScore(scores.pain           ?? 0),
      impact:         baseScore(scores.impact         ?? 0),
      critical_event: baseScore(scores.critical_event ?? 0),
      decision:       baseScore(scores.decision       ?? 0),
      delivery:       baseScore(scores.delivery       ?? 0),
    },
  }
}

function reachAnalyzing(): SessionState {
  let state = INITIAL_STATE
  state = liveCallReducer(state, { type: 'START_CAPTURE' })
  state = liveCallReducer(state, { type: 'PERMISSION_GRANTED' })
  state = liveCallReducer(state, { type: 'VAD_SPEECH_DETECTED' })
  state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
  return state // phase === 'ANALYZING'
}

// ---------------------------------------------------------------------------
// Group 1 — Valid Transitions
// ---------------------------------------------------------------------------

describe('Group 1 — Valid Transitions', () => {
  it('IDLE + START_CAPTURE → REQUESTING_PERMISSION, error is null', () => {
    const next = liveCallReducer(INITIAL_STATE, { type: 'START_CAPTURE' })
    expect(next.phase).toBe('REQUESTING_PERMISSION')
    expect(next.error).toBeNull()
  })

  it('REQUESTING_PERMISSION + PERMISSION_GRANTED → CAPTURING, startedAt matches ISO pattern', () => {
    let state = liveCallReducer(INITIAL_STATE, { type: 'START_CAPTURE' })
    state = liveCallReducer(state, { type: 'PERMISSION_GRANTED' })
    expect(state.phase).toBe('CAPTURING')
    expect(state.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('REQUESTING_PERMISSION + PERMISSION_DENIED → ERROR, error equals payload message', () => {
    let state = liveCallReducer(INITIAL_STATE, { type: 'START_CAPTURE' })
    state = liveCallReducer(state, { type: 'PERMISSION_DENIED', payload: { message: 'mic denied' } })
    expect(state.phase).toBe('ERROR')
    expect(state.error).toBe('mic denied')
  })

  it('CAPTURING + END_SESSION → SAVING, endedAt is non-null', () => {
    let state = liveCallReducer(INITIAL_STATE, { type: 'START_CAPTURE' })
    state = liveCallReducer(state, { type: 'PERMISSION_GRANTED' })
    state = liveCallReducer(state, { type: 'END_SESSION' })
    expect(state.phase).toBe('SAVING')
    expect(state.endedAt).not.toBeNull()
  })

  it('ANALYZING + ANALYSIS_COMPLETE → LISTENING, chunkCount incremented by 1', () => {
    const analyzing = reachAnalyzing()
    expect(analyzing.phase).toBe('ANALYZING')
    const payload = makeAnalysisPayload({})
    const next = liveCallReducer(analyzing, { type: 'ANALYSIS_COMPLETE', payload })
    expect(next.phase).toBe('LISTENING')
    expect(next.chunkCount).toBe(analyzing.chunkCount + 1)
  })

  it('SAVING + SAVE_SUCCESS → SAVED', () => {
    let state = liveCallReducer(INITIAL_STATE, { type: 'START_CAPTURE' })
    state = liveCallReducer(state, { type: 'PERMISSION_GRANTED' })
    state = liveCallReducer(state, { type: 'END_SESSION' })
    state = liveCallReducer(state, { type: 'SAVE_SUCCESS', payload: { sessionId: 'sess-001' } })
    expect(state.phase).toBe('SAVED')
  })

  it('ERROR + RESET → IDLE, all fields match INITIAL_STATE', () => {
    let state = liveCallReducer(INITIAL_STATE, { type: 'START_CAPTURE' })
    state = liveCallReducer(state, { type: 'PERMISSION_DENIED', payload: { message: 'denied' } })
    expect(state.phase).toBe('ERROR')
    const reset = liveCallReducer(state, { type: 'RESET' })
    expect(reset).toEqual(INITIAL_STATE)
  })
})

// ---------------------------------------------------------------------------
// Group 2 — Invalid Transitions (reference equality)
// ---------------------------------------------------------------------------

describe('Group 2 — Invalid Transitions', () => {
  it('IDLE + AUDIO_CHUNK_READY → IDLE (same state reference)', () => {
    const next = liveCallReducer(INITIAL_STATE, { type: 'AUDIO_CHUNK_READY' })
    expect(next).toBe(INITIAL_STATE)
  })

  it('IDLE + END_SESSION → IDLE (same state reference)', () => {
    const next = liveCallReducer(INITIAL_STATE, { type: 'END_SESSION' })
    expect(next).toBe(INITIAL_STATE)
  })

  it('ANALYZING + AUDIO_CHUNK_READY → ANALYZING (same state reference — concurrency guard)', () => {
    const analyzing = reachAnalyzing()
    const next = liveCallReducer(analyzing, { type: 'AUDIO_CHUNK_READY' })
    expect(next).toBe(analyzing)
  })

  it('SAVED + START_CAPTURE → SAVED (same state reference)', () => {
    let state = liveCallReducer(INITIAL_STATE, { type: 'START_CAPTURE' })
    state = liveCallReducer(state, { type: 'PERMISSION_GRANTED' })
    state = liveCallReducer(state, { type: 'END_SESSION' })
    state = liveCallReducer(state, { type: 'SAVE_SUCCESS', payload: { sessionId: 'x' } })
    expect(state.phase).toBe('SAVED')
    const next = liveCallReducer(state, { type: 'START_CAPTURE' })
    expect(next).toBe(state)
  })

  it('IDLE + ANALYSIS_COMPLETE → IDLE (same state, NO score merge)', () => {
    const payload = makeAnalysisPayload({ situation: 5, pain: 5 })
    const next = liveCallReducer(INITIAL_STATE, { type: 'ANALYSIS_COMPLETE', payload })
    expect(next).toBe(INITIAL_STATE)
    expect(next.spicedScores.situation.score).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Group 3 — Score Accumulation
// ---------------------------------------------------------------------------

describe('Group 3 — Score Accumulation', () => {
  it('higher incoming replaces lower current: situation 2 → 4', () => {
    // First chunk sets situation=2
    let state = reachAnalyzing()
    state = liveCallReducer(state, {
      type: 'ANALYSIS_COMPLETE',
      payload: makeAnalysisPayload({ situation: 2 }, 1),
    })
    expect(state.spicedScores.situation.score).toBe(2)

    // Move back to ANALYZING for second chunk
    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    expect(state.phase).toBe('ANALYZING')

    // Second chunk: situation=4 → should replace 2
    state = liveCallReducer(state, {
      type: 'ANALYSIS_COMPLETE',
      payload: makeAnalysisPayload({ situation: 4 }, 2),
    })
    expect(state.spicedScores.situation.score).toBe(4)
  })

  it('lower incoming does NOT replace higher: pain 5 stays 5 when incoming is 1', () => {
    let state = reachAnalyzing()
    state = liveCallReducer(state, {
      type: 'ANALYSIS_COMPLETE',
      payload: makeAnalysisPayload({ pain: 5 }, 1),
    })
    expect(state.spicedScores.pain.score).toBe(5)

    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    state = liveCallReducer(state, {
      type: 'ANALYSIS_COMPLETE',
      payload: makeAnalysisPayload({ pain: 1 }, 2),
    })
    expect(state.spicedScores.pain.score).toBe(5)
  })

  it('equal scores stay equal: current=3, incoming=3 → merged=3', () => {
    let state = reachAnalyzing()
    state = liveCallReducer(state, {
      type: 'ANALYSIS_COMPLETE',
      payload: makeAnalysisPayload({ impact: 3 }, 1),
    })
    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    state = liveCallReducer(state, {
      type: 'ANALYSIS_COMPLETE',
      payload: makeAnalysisPayload({ impact: 3 }, 2),
    })
    expect(state.spicedScores.impact.score).toBe(3)
  })

  it('three consecutive ANALYSIS_COMPLETE chunks accumulate across all dimensions', () => {
    // Chunk 1: situation=3
    let state = reachAnalyzing()
    state = liveCallReducer(state, {
      type: 'ANALYSIS_COMPLETE',
      payload: makeAnalysisPayload({ situation: 3 }, 1),
    })
    expect(state.spicedScores.situation.score).toBe(3)
    expect(state.spicedScores.pain.score).toBe(0)

    // Chunk 2: pain=4
    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    state = liveCallReducer(state, {
      type: 'ANALYSIS_COMPLETE',
      payload: makeAnalysisPayload({ pain: 4 }, 2),
    })
    expect(state.spicedScores.situation.score).toBe(3)
    expect(state.spicedScores.pain.score).toBe(4)
    expect(state.spicedScores.impact.score).toBe(0)

    // Chunk 3: impact=5
    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    state = liveCallReducer(state, {
      type: 'ANALYSIS_COMPLETE',
      payload: makeAnalysisPayload({ impact: 5 }, 3),
    })
    expect(state.spicedScores.situation.score).toBe(3)
    expect(state.spicedScores.pain.score).toBe(4)
    expect(state.spicedScores.impact.score).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// Group 4 — Transcript Accumulation
// ---------------------------------------------------------------------------

describe('Group 4 — Transcript Accumulation', () => {
  it('first ANALYSIS_COMPLETE: transcript contains the chunk text', () => {
    const payload = { ...makeAnalysisPayload({}), transcript_chunk: 'primeiro trecho' }
    const state = liveCallReducer(reachAnalyzing(), { type: 'ANALYSIS_COMPLETE', payload })
    expect(state.transcript).toContain('primeiro trecho')
  })

  it('second ANALYSIS_COMPLETE: transcript contains both chunks', () => {
    let state = reachAnalyzing()
    state = liveCallReducer(state, {
      type: 'ANALYSIS_COMPLETE',
      payload: { ...makeAnalysisPayload({}, 1), transcript_chunk: 'primeiro trecho' },
    })
    state = liveCallReducer(state, { type: 'AUDIO_CHUNK_READY' })
    state = liveCallReducer(state, {
      type: 'ANALYSIS_COMPLETE',
      payload: { ...makeAnalysisPayload({}, 2), transcript_chunk: 'segundo trecho' },
    })
    expect(state.transcript).toContain('primeiro trecho')
    expect(state.transcript).toContain('segundo trecho')
  })
})

// ---------------------------------------------------------------------------
// Group 5 — Counters
// ---------------------------------------------------------------------------

describe('Group 5 — Counters', () => {
  it('ANALYSIS_COMPLETE increments chunkCount by 1', () => {
    const state = reachAnalyzing()
    const before = state.chunkCount
    const next = liveCallReducer(state, {
      type: 'ANALYSIS_COMPLETE',
      payload: makeAnalysisPayload({}),
    })
    expect(next.chunkCount).toBe(before + 1)
  })

  it('ANALYSIS_ERROR increments analysisErrors by 1 and phase returns to LISTENING', () => {
    const state = reachAnalyzing()
    const before = state.analysisErrors
    const next = liveCallReducer(state, {
      type: 'ANALYSIS_ERROR',
      payload: { message: 'timeout', seq: 1 },
    })
    expect(next.analysisErrors).toBe(before + 1)
    expect(next.phase).toBe('LISTENING')
  })
})
