/**
 * tldv-webhook
 * Receives MeetingReady and TranscriptReady events from tl;dv.
 * Extracts deal_id from meeting name via regex \[(\d+)\].
 * Creates/updates record in `calls` with status 'pending'.
 * Invokes `enrich-call` asynchronously for TranscriptReady events.
 */

import { getSupabaseClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase.ts'
import { logStep, nowMs } from '../_shared/observability.ts'

const DEAL_ID_REGEX = /\[(\d+)\]/

/**
 * Verify webhook signature using HMAC-SHA256.
 * tl;dv sends the signature in x-tldv-signature header.
 * If TLDV_WEBHOOK_SECRET is not set, allow requests (backwards compat) but log warning.
 */
async function verifyWebhookSignature(req: Request, body: string): Promise<boolean> {
  const secret = Deno.env.get('TLDV_WEBHOOK_SECRET')
  if (!secret) {
    console.warn('[tldv-webhook] TLDV_WEBHOOK_SECRET not set — skipping signature verification')
    return true
  }

  const signature = req.headers.get('x-tldv-signature') ?? req.headers.get('x-webhook-signature') ?? ''
  if (!signature) {
    console.warn('[tldv-webhook] No signature header found in request')
    return false
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const expectedHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')

  // Support both raw hex and sha256= prefix
  const provided = signature.replace(/^sha256=/, '')
  return provided === expectedHex
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const startedAt = nowMs()
    const rawBody = await req.text()

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(req, rawBody)
    if (!isValid) {
      console.error('[tldv-webhook] Invalid webhook signature — rejecting request')
      return errorResponse('Invalid webhook signature', 401)
    }

    const payload = JSON.parse(rawBody)
    const eventType: string = payload?.event_type ?? payload?.type ?? ''
    const meeting = payload?.meeting ?? payload?.data?.meeting ?? {}

    const meetingId: string = meeting?.id ?? meeting?.meetingId ?? ''
    const meetingName: string = meeting?.name ?? meeting?.title ?? ''
    const meetingUrl: string = meeting?.url ?? meeting?.recording_url ?? ''
    const happenedAt: string | null = meeting?.happened_at ?? meeting?.started_at ?? null
    const durationSeconds: number | null = meeting?.duration_seconds ?? meeting?.duration ?? null
    const attendees: Array<{ email?: string; name?: string }> = meeting?.attendees ?? meeting?.participants ?? []

    if (!meetingId) {
      return errorResponse('Missing meetingId in payload', 400)
    }
    logStep({ function_name: 'tldv-webhook', call_id: meetingId, step: 'receive_event', status: 'start' })

    // Extract deal_id from meeting name: "Entrevista G4 | Closer [59321310764] | L"
    const dealIdMatch = meetingName.match(DEAL_ID_REGEX)
    const dealId: string | null = dealIdMatch ? dealIdMatch[1] : null

    const supabase = getSupabaseClient()

    // Avoid resetting pipeline status when tl;dv delivers delayed/burst events.
    const { data: existingCall, error: existingErr } = await supabase
      .from('calls')
      .select('id, processing_status, transcript_fetched')
      .eq('tldv_call_id', meetingId)
      .maybeSingle()

    if (existingErr) {
      console.error('Lookup error:', existingErr)
      return errorResponse('Failed to lookup call record', 500)
    }

    let call: { id: string; processing_status?: string | null; transcript_fetched?: boolean | null } | null = null
    if (existingCall) {
      const { data: updated, error: updateError } = await supabase
        .from('calls')
        .update({
          tldv_url: meetingUrl || null,
          deal_id: dealId,
          call_date: happenedAt,
          duration_seconds: durationSeconds,
        })
        .eq('id', existingCall.id)
        .select('id, processing_status, transcript_fetched')
        .single()
      if (updateError) {
        console.error('Update error:', updateError)
        return errorResponse('Failed to update call record', 500)
      }
      call = updated
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('calls')
        .insert({
          tldv_call_id: meetingId,
          tldv_url: meetingUrl || null,
          deal_id: dealId,
          processing_status: 'pending',
          call_date: happenedAt,
          duration_seconds: durationSeconds,
          transcript_fetched: false,
        })
        .select('id, processing_status, transcript_fetched')
        .single()
      if (insertError) {
        console.error('Insert error:', insertError)
        return errorResponse('Failed to insert call record', 500)
      }
      call = inserted
    }

    console.log(`[tldv-webhook] ${eventType} | meetingId=${meetingId} | dealId=${dealId} | callId=${call.id}`)

    // For MeetingReady: capture attendees/seller_email metadata
    if (eventType === 'MeetingReady' || eventType === 'meeting.ready') {
      // Try to identify the closer from attendees
      // Convention: closer is a @g4educacao.com.br participant
      const closerAttendee = attendees.find(a =>
        a.email?.toLowerCase().includes('@g4educacao.com.br') ||
        a.email?.toLowerCase().includes('@g4educacao.com')
      )
      if (closerAttendee?.email) {
        await supabase
          .from('calls')
          .update({ seller_email: closerAttendee.email })
          .eq('tldv_call_id', meetingId)
        console.log(`[tldv-webhook] MeetingReady | seller_email captured: ${closerAttendee.email} | attendees: ${attendees.length}`)
      } else {
        console.log(`[tldv-webhook] MeetingReady | no G4 attendee identified | attendees: ${attendees.length} | emails: ${attendees.map(a => a.email).join(', ')}`)
      }
    }

    // For TranscriptReady: trigger enrichment pipeline asynchronously
    if (eventType === 'TranscriptReady' || eventType === 'transcript.ready') {
      const shouldTriggerEnrich =
        !call?.transcript_fetched &&
        (call?.processing_status == null ||
          ['pending', 'enrich_failed', 'fetch_failed', 'transcript_failed'].includes(call.processing_status))

      if (!shouldTriggerEnrich) {
        logStep({
          function_name: 'tldv-webhook',
          call_id: call.id,
          step: 'dispatch_enrich',
          status: 'skip',
          details: {
            reason: 'already_processing_or_completed',
            processing_status: call?.processing_status ?? null,
            transcript_fetched: call?.transcript_fetched ?? null,
          },
        })
      } else {
      // Fire-and-forget: invoke enrich-call
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      fetch(`${supabaseUrl}/functions/v1/enrich-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ call_id: call.id }),
      }).catch((err) => console.error('[tldv-webhook] Failed to invoke enrich-call:', err))
      }
    }

    logStep({
      function_name: 'tldv-webhook',
      call_id: call.id,
      step: 'upsert_and_dispatch',
      status: 'ok',
      duration_ms: nowMs() - startedAt,
      details: { event_type: eventType },
    })
    return jsonResponse({ ok: true, call_id: call.id, deal_id: dealId, event_type: eventType })
  } catch (err) {
    logStep({
      function_name: 'tldv-webhook',
      step: 'receive_event',
      status: 'error',
      details: { message: err instanceof Error ? err.message : 'Unexpected error' },
    })
    console.error('[tldv-webhook] Unexpected error:', err)
    return errorResponse('Internal server error', 500)
  }
})
