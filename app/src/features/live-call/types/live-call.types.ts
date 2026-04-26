// live-call.types.ts
// All TypeScript contracts for the live-call feature.
// No runtime code — types and interfaces only.
// Consumed by: liveCallStore.ts, geminiLiveAnalysis.ts, useChunkAnalysis.ts (Phase 3), UI panels (Phase 4)

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

// The 8 phases of a live call session lifecycle.
// Transitions are governed by liveCallReducer in liveCallStore.ts.
export type LiveCallPhase =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'CAPTURING'
  | 'LISTENING'
  | 'ANALYZING'
  | 'SAVING'
  | 'SAVED'
  | 'ERROR'

// ---------------------------------------------------------------------------
// SPICED Score Types
// ---------------------------------------------------------------------------

// Score for a single SPICED dimension.
// `max` is a literal 5 — enforces the 0–5 scale contract at the type level.
export interface DimensionScore {
  score: number  // 0–5
  max: 5
}

// Cumulative scores for all 6 SPICED dimensions.
// Note: includes "delivery" as the 6th dimension (beyond the S-P-I-C-D classic set).
// Scores only increase mid-session (Math.max in reducer). Never reset until RESET action.
export interface SpicedScores {
  situation:      DimensionScore
  pain:           DimensionScore
  impact:         DimensionScore
  critical_event: DimensionScore
  decision:       DimensionScore
  delivery:       DimensionScore
}

// ---------------------------------------------------------------------------
// Signal + Red Flag Types
// ---------------------------------------------------------------------------

// A behavioral signal detected by one of the sales frameworks.
// Up to 5 signals returned per 10-second audio chunk.
export interface Signal {
  signal_id: string
  framework: 'SPICED' | 'CHALLENGER' | 'SPIN' | 'CROSS'
  dimension: string
  polarity:  'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  intensity: 1 | 2 | 3
  excerpt:   string
}

// A red flag emitted when a critical negative pattern is detected.
// Only included in the response when actually detected (array may be empty).
export interface RedFlag {
  flag:        string
  severity:    'warning' | 'critical'
  description: string
}

// ---------------------------------------------------------------------------
// Gemini Chunk Analysis Response
// ---------------------------------------------------------------------------

// Structured JSON response from Gemini for a single 10-second audio chunk.
// The LIVE_CALL_SYSTEM_PROMPT instructs Gemini to return exactly this shape.
// Consumed by geminiLiveAnalysis.ts and dispatched as ANALYSIS_COMPLETE payload.
export interface LiveChunkAnalysis {
  transcript_chunk:        string
  suggested_question:      string
  active_spiced_dimension: 'situation' | 'pain' | 'impact' | 'critical_event' | 'decision' | 'delivery'
  spiced_scores:           SpicedScores
  signals:                 Signal[]    // up to 5 per chunk
  red_flags:               RedFlag[]   // empty array when none detected
}

// ---------------------------------------------------------------------------
// Session Store State
// ---------------------------------------------------------------------------

// Full state managed by useLiveCallStore (useReducer-based).
// All fields are nullable when not yet populated — avoids optional chaining inconsistencies.
export interface SessionState {
  phase:                   LiveCallPhase
  transcript:              string         // full accumulated transcript (grows per ANALYSIS_COMPLETE)
  spicedScores:            SpicedScores   // cumulative; Math.max per dimension
  signals:                 Signal[]       // all signals from all chunks
  redFlags:                RedFlag[]      // all red flags from all chunks
  suggestedQuestion:       string | null  // latest suggested question; null until first analysis
  activeSpicedDimension:   'situation' | 'pain' | 'impact' | 'critical_event' | 'decision' | 'delivery' | null
  chunkCount:              number         // incremented on each ANALYSIS_COMPLETE
  analysisErrors:          number         // incremented on each ANALYSIS_ERROR
  startedAt:               string | null  // ISO string; set on PERMISSION_GRANTED
  endedAt:                 string | null  // ISO string; set on END_SESSION
  error:                   string | null  // last error message; cleared on START_CAPTURE
  talkRatioCloser?:        number             // 0–100, % do closer; populado via análise futura
}

// ---------------------------------------------------------------------------
// Session Actions (Reducer Events)
// ---------------------------------------------------------------------------

// Discriminated union of all actions that can be dispatched to liveCallReducer.
// The `seq` field on ANALYSIS_COMPLETE and ANALYSIS_ERROR is the monotonic sequence
// number from latestSeqRef — used by the concurrency guard in useChunkAnalysis (Phase 3)
// to discard out-of-order responses. The reducer itself does not validate seq.
export type SessionAction =
  | { type: 'START_CAPTURE' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED';  payload: { message: string } }
  | { type: 'VAD_SPEECH_DETECTED' }
  | { type: 'AUDIO_CHUNK_READY' }
  | { type: 'ANALYSIS_COMPLETE';  payload: LiveChunkAnalysis & { seq: number } }
  | { type: 'ANALYSIS_ERROR';     payload: { message: string; seq: number } }
  | { type: 'END_SESSION' }
  | { type: 'SAVE_SUCCESS';       payload: { sessionId: string } }
  | { type: 'SAVE_ERROR';         payload: { message: string } }
  | { type: 'ERROR_OCCURRED';     payload: { message: string } }
  | { type: 'RESET' }
