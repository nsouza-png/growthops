/**
 * Integration example: How to trigger gp-orchestrate-pipeline from tldv-webhook
 * 
 * Add this code to supabase/functions/tldv-webhook/index.ts after fetch-transcript completes
 */

// After the fetch-transcript function is successfully invoked in tldv-webhook:

async function triggerPipelineOrchestration(callId: string, userId: string) {
  const supabase = getSupabaseClient()
  
  try {
    console.log(`[tldv-webhook] Triggering pipeline orchestration for call ${callId}`)
    
    // Option 1: Invoke Edge Function directly
    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      'gp-orchestrate-pipeline',
      {
        body: {
          call_id: callId,
          user_id: userId,
          parallel_mode: true // Enable parallelization for speed
        }
      }
    )
    
    if (functionError) {
      console.error(`[tldv-webhook] Pipeline orchestration failed:`, functionError)
      // Don't throw - the call is already in the system
      return false
    }
    
    console.log(`[tldv-webhook] Pipeline orchestration triggered successfully`)
    console.log(`[tldv-webhook] Results: ${JSON.stringify(functionData)}`)
    
    return true
  } catch (error) {
    console.error(`[tldv-webhook] Error triggering pipeline:`, error)
    // Log but don't fail the webhook
    return false
  }
}

// ============ INTEGRATION POINT ============
// In tldv-webhook, after fetch-transcript completes, add:

/*
async function webhookHandler() {
  // ... existing webhook code ...
  
  // After fetch-transcript successfully completes:
  const { seller_id, call_id } = call_data
  
  await triggerPipelineOrchestration(call_id, seller_id)
  
  // Pipeline now runs asynchronously in background
  // All derived tables will be populated automatically
}
*/

// ============ ALTERNATIVE: Queue-based (for high volume) ============

/**
 * For high-volume environments, use Supabase Realtime or a job queue:
 */

async function queuePipelineJob(callId: string, userId: string) {
  const supabase = getSupabaseClient()
  
  // Insert into a job queue table
  const { error } = await supabase
    .from('pipeline_jobs')
    .insert({
      call_id: callId,
      user_id: userId,
      job_type: 'orchestrate_full_pipeline',
      status: 'pending',
      created_at: new Date().toISOString(),
      retry_count: 0
    })
  
  if (error) {
    console.error('[tldv-webhook] Failed to queue pipeline job:', error)
    return false
  }
  
  console.log(`[tldv-webhook] Pipeline job queued for call ${callId}`)
  return true
}

// ============ EXPECTED WORKFLOW ============

/*
1. Call arrives via tl;dv webhook
2. tldv-webhook extracts metadata and creates call record
3. fetch-transcript fetches transcript from tl;dv API
4. [NEW] gp-orchestrate-pipeline is triggered
5. Pipeline orchestrator runs 7 stages:
   - Stage 1 (seq): call_analysis
   - Stages 2-4 (parallel): behavior_signals, framework_scores, business_analysis
   - Stage 5: smart_alerts
   - Stage 6: call_followups
   - Stage 7: closer_pdi
6. All derived tables populated with GPT insights
7. Smart alerts notify team of issues/opportunities
8. PDI ready for coaching
9. Followups suggested for next action

Total time: 30-45 seconds
Total AI cost: ~$0.12 per call
Tables populated: 7
Derived data: 100+ fields
*/

// ============ MONITORING ============

async function getOrchestrationStats(limit: number = 100) {
  const supabase = getSupabaseClient()
  
  // Get recent orchestration jobs
  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, processing_status, processing_stage, updated_at')
    .eq('processing_stage', 'all_derived_tables_populated')
    .order('updated_at', { ascending: false })
    .limit(limit)
  
  if (error) return null
  
  // Stats
  const totalProcessed = calls.length
  const allDerivedPopulated = calls.filter(
    c => c.processing_status === 'completed'
  ).length
  
  return {
    total_processed: totalProcessed,
    all_derived_populated: allDerivedPopulated,
    success_rate: (allDerivedPopulated / totalProcessed) * 100,
    avg_age_minutes: calls[0] 
      ? Math.round((Date.now() - new Date(calls[0].updated_at).getTime()) / 60000)
      : 0
  }
}

export { triggerPipelineOrchestration, queuePipelineJob, getOrchestrationStats }
