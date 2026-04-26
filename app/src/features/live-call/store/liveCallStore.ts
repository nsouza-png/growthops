// liveCallStore.ts
// State machine for the live-call feature.
// Exports: INITIAL_STATE, liveCallReducer, useLiveCallStore
// No default export — all exports are named.

import { useReducer, type Dispatch } from 'react'
import type { SessionState, SessionAction, SpicedScores, LiveCallPhase } from '../types/live-call.types'

// ---------------------------------------------------------------------------
// Valid Transitions Table (17 entries)
// ---------------------------------------------------------------------------
// Key: `${currentPhase}:${actionType}` → nextPhase
// Any combination not listed here is an invalid transition → return state unchanged.

type TransitionKey = `${LiveCallPhase}:${SessionAction['type']}`

const VALID_TRANSITIONS: Partial<Record<TransitionKey, LiveCallPhase>> = {
  // 1
  'IDLE:START_CAPTURE':                        'REQUESTING_PERMISSION',
  // 2
  'REQUESTING_PERMISSION:PERMISSION_GRANTED':  'CAPTURING',
  // 3
  'REQUESTING_PERMISSION:PERMISSION_DENIED':   'ERROR',
  // 4
  'CAPTURING:VAD_SPEECH_DETECTED':             'LISTENING',
  // 5
  'CAPTURING:END_SESSION':                     'SAVING',
  // 6
  'CAPTURING:ERROR_OCCURRED':                  'ERROR',
  // 7
  'LISTENING:AUDIO_CHUNK_READY':               'ANALYZING',
  // 8
  'LISTENING:END_SESSION':                     'SAVING',
  // 9
  'LISTENING:ERROR_OCCURRED':                  'ERROR',
  // 10
  'ANALYZING:ANALYSIS_COMPLETE':               'LISTENING',
  // 11
  'ANALYZING:ANALYSIS_ERROR':                  'LISTENING',
  // 12
  'ANALYZING:END_SESSION':                     'SAVING',
  // 13
  'ANALYZING:ERROR_OCCURRED':                  'ERROR',
  // 14
  'SAVING:SAVE_SUCCESS':                       'SAVED',
  // 15
  'SAVING:SAVE_ERROR':                         'ERROR',
  // 16
  'SAVED:RESET':                               'IDLE',
  // 17
  'ERROR:RESET':                               'IDLE',
}

// ---------------------------------------------------------------------------
// INITIAL_STATE
// ---------------------------------------------------------------------------

export const INITIAL_STATE: SessionState = {
  phase: 'IDLE',
  transcript: '',
  spicedScores: {
    situation:      { score: 0, max: 5 },
    pain:           { score: 0, max: 5 },
    impact:         { score: 0, max: 5 },
    critical_event: { score: 0, max: 5 },
    decision:       { score: 0, max: 5 },
    delivery:       { score: 0, max: 5 },
  },
  signals: [],
  redFlags: [],
  suggestedQuestion: null,
  activeSpicedDimension: null,
  chunkCount: 0,
  analysisErrors: 0,
  startedAt: null,
  endedAt: null,
  error: null,
  talkRatioCloser: undefined,
}

// ---------------------------------------------------------------------------
// Score Accumulation Helper
// ---------------------------------------------------------------------------
// Merges two SpicedScores objects, keeping the maximum score per dimension.
// Pure function — no side effects.

function mergeSpicedScores(current: SpicedScores, incoming: SpicedScores): SpicedScores {
  return {
    situation:      { score: Math.max(current.situation.score,      incoming.situation.score),      max: 5 },
    pain:           { score: Math.max(current.pain.score,           incoming.pain.score),           max: 5 },
    impact:         { score: Math.max(current.impact.score,         incoming.impact.score),         max: 5 },
    critical_event: { score: Math.max(current.critical_event.score, incoming.critical_event.score), max: 5 },
    decision:       { score: Math.max(current.decision.score,       incoming.decision.score),       max: 5 },
    delivery:       { score: Math.max(current.delivery.score,       incoming.delivery.score),       max: 5 },
  }
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
// Pure function — no side effects (no console.log, no fetch, no timers).
// Invalid transitions return the same state reference (reference equality preserved).

export function liveCallReducer(state: SessionState, action: SessionAction): SessionState {
  // RESET is unconditional — always returns INITIAL_STATE regardless of current phase.
  if (action.type === 'RESET') {
    return INITIAL_STATE
  }

  // Look up the transition key.
  const key = `${state.phase}:${action.type}` as TransitionKey
  const nextPhase = VALID_TRANSITIONS[key]

  // Invalid transition → return same reference (no copy).
  if (nextPhase === undefined) {
    return state
  }

  // Build the next state based on action type.
  switch (action.type) {
    case 'START_CAPTURE': {
      // IDLE → REQUESTING_PERMISSION
      // Clear any previous error on start.
      return {
        ...state,
        phase: nextPhase,
        error: null,
      }
    }

    case 'PERMISSION_GRANTED': {
      // REQUESTING_PERMISSION → CAPTURING
      return {
        ...state,
        phase: nextPhase,
        startedAt: new Date().toISOString(),
      }
    }

    case 'PERMISSION_DENIED': {
      // REQUESTING_PERMISSION → ERROR
      return {
        ...state,
        phase: nextPhase,
        error: action.payload.message,
      }
    }

    case 'VAD_SPEECH_DETECTED': {
      // CAPTURING → LISTENING
      return {
        ...state,
        phase: nextPhase,
      }
    }

    case 'AUDIO_CHUNK_READY': {
      // LISTENING → ANALYZING
      // Note: ANALYZING + AUDIO_CHUNK_READY is NOT in VALID_TRANSITIONS,
      // so concurrency guard (no double-analysis) is enforced by the table above.
      return {
        ...state,
        phase: nextPhase,
      }
    }

    case 'ANALYSIS_COMPLETE': {
      // Only valid when state.phase === 'ANALYZING' (enforced by VALID_TRANSITIONS above).
      // Accumulate transcript, scores, signals, red flags.
      const { transcript_chunk, suggested_question, active_spiced_dimension, spiced_scores, signals, red_flags } = action.payload
      return {
        ...state,
        phase: nextPhase,
        transcript: state.transcript
          ? `${state.transcript}\n${transcript_chunk}`
          : transcript_chunk,
        spicedScores: mergeSpicedScores(state.spicedScores, spiced_scores),
        signals: [...state.signals, ...signals],
        redFlags: [...state.redFlags, ...red_flags],
        suggestedQuestion: suggested_question,
        activeSpicedDimension: active_spiced_dimension,
        chunkCount: state.chunkCount + 1,
      }
    }

    case 'ANALYSIS_ERROR': {
      // ANALYZING → LISTENING (soft error — session continues)
      return {
        ...state,
        phase: nextPhase,
        analysisErrors: state.analysisErrors + 1,
      }
    }

    case 'END_SESSION': {
      // CAPTURING | LISTENING | ANALYZING → SAVING
      return {
        ...state,
        phase: nextPhase,
        endedAt: new Date().toISOString(),
      }
    }

    case 'SAVE_SUCCESS': {
      // SAVING → SAVED
      // sessionId is available in payload but not stored in SessionState (no field for it).
      return {
        ...state,
        phase: nextPhase,
      }
    }

    case 'SAVE_ERROR': {
      // SAVING → ERROR
      return {
        ...state,
        phase: nextPhase,
        error: action.payload.message,
      }
    }

    case 'ERROR_OCCURRED': {
      // CAPTURING | LISTENING | ANALYZING → ERROR
      return {
        ...state,
        phase: nextPhase,
        error: action.payload.message,
      }
    }

    default: {
      // Exhaustive check — TypeScript should catch unhandled actions at compile time.
      return state
    }
  }
}

// ---------------------------------------------------------------------------
// useLiveCallStore — React hook
// ---------------------------------------------------------------------------
// Wraps useReducer. Returns { state, dispatch }.
// This is the only place React is used in this module.

export function useLiveCallStore(): { state: SessionState; dispatch: Dispatch<SessionAction> } {
  const [state, dispatch] = useReducer(liveCallReducer, INITIAL_STATE)
  return { state, dispatch }
}
