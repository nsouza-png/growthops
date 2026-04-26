/**
 * gp-pipeline-sync
 *
 * Called automatically by DB trigger when public.calls.status = 'analyzed'.
 * Also callable manually: POST { public_call_id: uuid }
 *
 * Pipeline:
 *   1. Read gp_calls + gp_call_analysis (views over GrowthPlatform schema)
 *   2. Build transcript text from speaker_segments or transcript_raw
 *   3. Upsert into GrowthPlatform.calls via upsert_gp_call RPC
 *   4. Fire all GP scoring Edge Functions in parallel:
 *      gp-score-challenger, gp-score-spiced, gp-score-spin,
 *      gp-map-behavior-signals, gp-analyze-business
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}
function err(msg: string, status = 500) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: corsHeaders })
}

// ── Extract readable transcript from call_analysis ───────────────────────────

function extractTranscript(analysis: Record<string, unknown> | null): string {
  if (!analysis) return ""

  // Option A: speaker_segments JSONB array
  const segs = analysis.speaker_segments as Array<{ speaker?: string; text?: string; words?: Array<{ text: string }> }> | null
  if (segs && Array.isArray(segs) && segs.length > 0) {
    return segs
      .map((s) => {
        const text = s.text ?? s.words?.map((w) => w.text).join(" ") ?? ""
        return `${s.speaker ?? "Desconhecido"}: ${text}`
      })
      .join("\n")
  }

  // Option B: transcript_raw JSONB
  const raw = analysis.transcript_raw as { segments?: Array<{ text: string; speaker?: string }> } | null
  if (raw?.segments && Array.isArray(raw.segments)) {
    return raw.segments
      .map((s) => `${s.speaker ?? "Speaker"}: ${s.text}`)
      .join("\n")
  }

  // Option C: use summary_text as fallback (much shorter but better than nothing)
  const parts: string[] = []
  if (analysis.summary_text) parts.push(`RESUMO: ${analysis.summary_text}`)
  if (Array.isArray(analysis.client_pains)) {
    parts.push("DORES: " + (analysis.client_pains as Array<{ text?: string }>).map(p => p.text).join("; "))
  }
  if (Array.isArray(analysis.next_steps)) {
    parts.push("PRÓXIMOS PASSOS: " + (analysis.next_steps as Array<{ text?: string }>).map(s => s.text).join("; "))
  }
  return parts.join("\n\n")
}

// ── Invoke a GP scoring Edge Function (fire-and-forget) ──────────────────────

async function fireScorer(fn: string, payload: { call_id: string; transcript: string }) {
  const url = `${SUPABASE_URL}/functions/v1/${fn}`
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  }).catch((e) => console.error(`[gp-pipeline-sync] ${fn} fire failed:`, e.message))
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { public_call_id } = await req.json()
    if (!public_call_id) return err("Missing public_call_id", 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      db: { schema: 'GrowthPlatform' },
    })

    // 1. Load call + analysis via gp_* views
    const { data: call, error: callErr } = await supabase
      .from("calls")
      .select("*")
      .eq("id", public_call_id)
      .single()

    if (callErr || !call) return err(`Call not found: ${callErr?.message}`, 404)

    const { data: analysis } = await supabase
      .from("call_analysis")
      .select("*")
      .eq("call_id", public_call_id)
      .single()

    // 2. Build transcript
    const transcript = extractTranscript(analysis)
    const wordCount = transcript.split(/\s+/).filter(Boolean).length

    // 3. Resolve seller info from seller_email
    let sellerName = call.lead ?? ""  // fallback
    if (call.seller_email) {
      const { data: hc } = await supabase
        .from("profiles")
        .select("name")
        .eq("email", call.seller_email)
        .single()
      if (hc?.name) sellerName = hc.name
    }

    // 4. Upsert into GrowthPlatform.calls via RPC
    const { data: gpCallId, error: syncErr } = await supabase.rpc("upsert_gp_call", {
      p_tldv_call_id:     call.tldv_call_id ?? `pub-${call.id}`,
      p_seller_email:     call.seller_email ?? "",
      p_seller_name:      sellerName,
      p_prospect_name:    call.lead ?? "",
      p_prospect_company: call.lead_segmento ?? "",
      p_segment:          call.lead_segmento ?? "",
      p_call_date:        call.call_date ?? call.created_at,
      p_duration_min:     call.duration_seconds ? Math.round(call.duration_seconds / 60) : null,
      p_transcript_text:  transcript || null,
      p_word_count:       wordCount || null,
      p_processing_status: "done",
    })

    if (syncErr) {
      console.error("[gp-pipeline-sync] upsert_gp_call failed:", syncErr.message)
      return err(`upsert_gp_call failed: ${syncErr.message}`)
    }

    const gp_call_id: string = gpCallId

    console.log(`[gp-pipeline-sync] Synced call ${public_call_id} → GP ${gp_call_id}`)

    // 5. If no transcript, skip AI scoring
    if (!transcript || transcript.length < 100) {
      console.warn(`[gp-pipeline-sync] No transcript for ${public_call_id} — skipping AI scoring`)
      return ok({ ok: true, gp_call_id, scored: false, reason: "no transcript" })
    }

    const payload = { call_id: gp_call_id, transcript }

    // 6. Fire all GP scoring functions in parallel (fire-and-forget)
    await Promise.all([
      fireScorer("gp-score-challenger",    payload),
      fireScorer("gp-score-spiced",        payload),
      fireScorer("gp-score-spin",          payload),
      fireScorer("gp-map-behavior-signals", payload),
      fireScorer("gp-analyze-business",    payload),
    ])

    console.log(`[gp-pipeline-sync] All scorers fired for GP call ${gp_call_id}`)

    return ok({ ok: true, gp_call_id, scored: true })

  } catch (e) {
    console.error("[gp-pipeline-sync] Unexpected error:", e)
    return err(`Internal error: ${(e as Error).message}`)
  }
})
