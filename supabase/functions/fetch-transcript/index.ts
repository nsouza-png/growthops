/**
 * fetch-transcript
 * Fetches the full transcript from tl;dv API for a given call.
 * Stores the transcript as JSONB on call_analysis.
 * Triggers analyze-call asynchronously.
 */

import { getSupabaseClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase.ts'
import { logStep, nowMs } from '../_shared/observability.ts'

const TLDV_BASE_URL = 'https://pasta.tldv.io'

interface TranscriptSegment {
  speaker: string
  words: string
  start_time?: number
  end_time?: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const startedAt = nowMs()
    const { call_id } = await req.json()
    if (!call_id) return errorResponse('Missing call_id', 400)

    const tldvApiKey = Deno.env.get('TLDV_API_KEY')
    if (!tldvApiKey) return errorResponse('TLDV_API_KEY not configured', 500)

    const supabase = getSupabaseClient()
    logStep({ function_name: 'fetch-transcript', call_id, step: 'start', status: 'start' })

    const { data: lockRows } = await supabase
      .from('calls')
      .update({ processing_status: 'fetching_transcript' })
      .eq('id', call_id)
      .in('processing_status', ['pending', 'enriching', 'fetch_failed', 'transcript_failed'])
      .select('id')
    if (!lockRows || lockRows.length === 0) {
      logStep({
        function_name: 'fetch-transcript',
        call_id,
        step: 'lock',
        status: 'skip',
        duration_ms: nowMs() - startedAt,
        details: { reason: 'already_processing_or_completed' },
      })
      return jsonResponse({ ok: true, call_id, skipped: true, reason: 'already_processing_or_completed' })
    }

    // Fetch call record
    const { data: call, error: fetchError } = await supabase
      .from('calls')
      .select('id, tldv_call_id, transcript_fetched, seller_email')
      .eq('id', call_id)
      .single()

    if (fetchError || !call) return errorResponse('Call not found', 404)
    if (call.transcript_fetched) {
      console.log(`[fetch-transcript] Transcript already fetched for call ${call_id}`)
      return jsonResponse({ ok: true, call_id, skipped: true })
    }

    // Fetch transcript from tl;dv
    const transcriptRes = await fetch(
      `${TLDV_BASE_URL}/v1alpha1/meetings/${call.tldv_call_id}/transcript`,
      {
        headers: { 'x-api-key': tldvApiKey },
      }
    )

    if (!transcriptRes.ok) {
      const body = await transcriptRes.text()
      console.error(`[fetch-transcript] tl;dv API error ${transcriptRes.status}:`, body)
      return errorResponse(`tl;dv API error: ${transcriptRes.status}`, 502)
    }

    const transcriptData = await transcriptRes.json()
    const segments: TranscriptSegment[] = transcriptData?.transcript ?? transcriptData?.segments ?? []

    // Compute basic talk ratio from segment durations
    let sellerTime = 0
    let clientTime = 0
    const speakers = new Set(segments.map((s) => s.speaker))

    // Try to identify seller speaker by seller_email in transcript metadata
    // tl;dv may include speaker.email in transcript segments
    const speakerList = Array.from(speakers)
    let sellerSpeaker = ''

    if (call.seller_email) {
      // Try to find speaker whose name/id matches the seller email
      const emailUser = call.seller_email.split('@')[0].toLowerCase()
      const matchedSpeaker = speakerList.find(sp =>
        sp.toLowerCase().includes(emailUser) ||
        emailUser.includes(sp.toLowerCase().replace(/\s+/g, '.'))
      )
      if (matchedSpeaker) {
        sellerSpeaker = matchedSpeaker
        console.log(`[fetch-transcript] Identified seller speaker: "${sellerSpeaker}" via seller_email match`)
      }
    }

    // Tentativa 3: buscar seller_email via gp_profiles se não disponível na call
    if (!sellerSpeaker && !call.seller_email) {
      // Buscar deal_id da call para fazer lookup
      const { data: callFull } = await supabase
        .from('calls')
        .select('deal_id')
        .eq('id', call_id)
        .single()

      if (callFull?.deal_id) {
        const { data: hc } = await supabase
          .from('profiles')
          .select('email')
          .eq('deal_id', callFull.deal_id)
          .maybeSingle()

        if (hc?.email) {
          const emailUser = hc.email.split('@')[0].toLowerCase()
          const matchedSpeaker = speakerList.find(sp =>
            sp.toLowerCase().includes(emailUser) ||
            emailUser.includes(sp.toLowerCase().replace(/\s+/g, '.'))
          )
          if (matchedSpeaker) {
            sellerSpeaker = matchedSpeaker
            console.log(`[fetch-transcript] Identified seller speaker: "${sellerSpeaker}" via headcount_comercial lookup`)
          }
        }
      }
    }

    if (!sellerSpeaker) {
      // Fallback heuristic: first speaker = seller
      sellerSpeaker = speakerList[0] ?? ''
      console.warn(`[fetch-transcript] WARNING: using first-speaker heuristic for talk ratio — seller_email ${call.seller_email ? 'did not match any speaker' : 'not available'}`)
    }

    for (const seg of segments) {
      const duration = (seg.end_time ?? 0) - (seg.start_time ?? 0)
      if (seg.speaker === sellerSpeaker) sellerTime += duration
      else clientTime += duration
    }

    const totalTime = sellerTime + clientTime
    const talkRatioSeller = totalTime > 0 ? (sellerTime / totalTime) * 100 : 50
    const talkRatioClient = totalTime > 0 ? (clientTime / totalTime) * 100 : 50

    // Count seller questions (sentences ending in ?)
    const sellerText = segments
      .filter((s) => s.speaker === sellerSpeaker)
      .map((s) => s.words)
      .join(' ')
    const questionsCount = (sellerText.match(/\?/g) ?? []).length

    // Find longest monologue
    let longestMonologue = 0
    for (const seg of segments) {
      const dur = (seg.end_time ?? 0) - (seg.start_time ?? 0)
      if (dur > longestMonologue) longestMonologue = dur
    }

    const transcriptText = segments
      .map((seg) => `[${seg.speaker}] ${seg.words ?? ''}`.trim())
      .filter(Boolean)
      .join('\n')

    // Upsert call_analysis with transcript behaviour data
    const { error: analysisError } = await supabase
      .from('call_analysis')
      .upsert(
        {
          call_id,
          talk_ratio_seller: parseFloat(talkRatioSeller.toFixed(2)),
          talk_ratio_client: parseFloat(talkRatioClient.toFixed(2)),
          longest_monologue_s: Math.round(longestMonologue),
          questions_count: questionsCount,
          transcript_raw: segments,
          is_simulation: false,
        },
        { onConflict: 'call_id' }
      )

    if (analysisError) {
      await supabase.from('calls').update({ processing_status: 'transcript_failed' }).eq('id', call_id)
      console.error('[fetch-transcript] Analysis upsert error:', analysisError)
      return errorResponse('Failed to store transcript analysis', 500)
    }

    // Mark transcript as fetched
    await supabase
      .from('calls')
      .update({
        transcript_fetched: true,
        processing_status: 'enriched',
        transcript_text: transcriptText || null,
      })
      .eq('id', call_id)

    console.log(`[fetch-transcript] Stored transcript for call ${call_id} | ${segments.length} segments`)
    logStep({
      function_name: 'fetch-transcript',
      call_id,
      step: 'store_transcript',
      status: 'ok',
      duration_ms: nowMs() - startedAt,
      details: { segments: segments.length },
    })

    // Trigger analyze-call asynchronously
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ call_id }),
    }).catch((err) => console.error('[fetch-transcript] Failed to invoke analyze-call:', err))

    // Trigger transcript indexing for RAG (500/150 per recommendation).
    fetch(`${supabaseUrl}/functions/v1/rag-index-transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        call_id,
        chunkSize: 500,
        chunkOverlap: 150,
        auto_enrich: true,
      }),
    }).catch((err) => console.error('[fetch-transcript] Failed to invoke rag-index-transcript:', err))

    return jsonResponse({ ok: true, call_id, segments: segments.length })
  } catch (err) {
    logStep({
      function_name: 'fetch-transcript',
      step: 'store_transcript',
      status: 'error',
      details: { message: err instanceof Error ? err.message : 'Unexpected error' },
    })
    console.error('[fetch-transcript] Unexpected error:', err)
    return errorResponse('Internal server error', 500)
  }
})
