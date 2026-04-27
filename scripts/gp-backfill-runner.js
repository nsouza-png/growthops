#!/usr/bin/env node

/**
 * gp-backfill-runner.js
 *
 * Main orchestrator for backfilling all 5,637 calls with derived table data.
 * - Rate limited (configurable)
 * - Batch processing (parallel)
 * - Auto-retry with exponential backoff
 * - Checkpoint persistence for resume capability
 * - Real-time progress tracking
 *
 * Usage:
 *   node gp-backfill-runner.js [--dry-run] [--start-from N] [--resume] [--retry-failed]
 *   node gp-backfill-runner.js --dry-run # Validate without changes
 *   node gp-backfill-runner.js --start-from 100 # Resume from call #100
 *   node gp-backfill-runner.js --retry-failed # Retry only failed calls
 *
 * Environment Variables:
 *   BACKFILL_BATCH_SIZE=5 (default: 5, range: 1-10)
 *   BACKFILL_RATE_LIMIT_PER_MIN=12 (default: 12, 60/12 = 5sec per call)
 *   BACKFILL_RETRY_COUNT=3 (default: 3)
 *   BACKFILL_TIMEOUT_SEC=120 (default: 120)
 */

const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const fs = require('fs')
const path = require('path')

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'GrowthPlatform' } }
)

// Configuration
const BATCH_SIZE = parseInt(process.env.BACKFILL_BATCH_SIZE || '5', 10)
const RATE_LIMIT_PER_MIN = parseInt(process.env.BACKFILL_RATE_LIMIT_PER_MIN || '12', 10)
const RETRY_COUNT = parseInt(process.env.BACKFILL_RETRY_COUNT || '3', 10)
const TIMEOUT_SEC = parseInt(process.env.BACKFILL_TIMEOUT_SEC || '120', 10)
const DELAY_BETWEEN_BATCHES_MS = Math.max(250, Math.floor((60 * 1000) / Math.max(1, RATE_LIMIT_PER_MIN / Math.max(1, BATCH_SIZE))))

// Parse CLI args
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const resumeMode = args.includes('--resume')
const retryFailedOnly = args.includes('--retry-failed')
const startFromArg = args.find((a) => a.startsWith('--start-from'))
const startFrom = startFromArg
  ? parseInt(startFromArg.split('=')[1] || args[args.indexOf(startFromArg) + 1], 10)
  : 1

// Checkpoint file
const checkpointFile = path.join(process.cwd(), "backfill-checkpoint.json");

function log(level, message, details) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  if (details) {
    console.log(`${prefix} ${message}`, details);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

function saveCheckpoint(checkpoint) {
  fs.writeFileSync(checkpointFile, JSON.stringify(checkpoint, null, 2));
}

function loadCheckpoint() {
  if (!fs.existsSync(checkpointFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(checkpointFile, "utf-8"));
  } catch {
    return null;
  }
}

async function getAllCallIds() {
  const { data, error } = await supabase
    .from("calls")
    .select("id")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch call IDs: ${error.message}`);
  return data.map((d) => d.id);
}

async function checkIfDerivedTablesPopulated(callId) {
  const { data: analysis } = await supabase
    .from("call_analysis")
    .select("id")
    .eq("call_id", callId)
    .single();

  return !!analysis;
}

async function invokeOrchestrator(
  callId,
  userId,
  retryCount = 0
) {
  try {
    const { data, error } = await supabase.functions.invoke(
      "gp-orchestrate-pipeline",
      {
        body: {
          call_id: callId,
          user_id: userId,
          parallel_mode: true,
        },
      }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processCallBatch(
  callIds,
  checkpoint
) {
  const batchStartTime = Date.now();

  for (let i = 0; i < callIds.length; i++) {
    const callId = callIds[i];
    let retryAttempt = 0;
    let success = false;
    let error = "";

    // Skip if already processed
    if (dryRun) {
      log("INFO", `[DRY-RUN] Would process call ${i + 1}/${callIds.length}`, { call_id: callId });
      checkpoint.processed_count++;
      checkpoint.success_count++;
    } else {
      while (retryAttempt < RETRY_COUNT && !success) {
        try {
          log("INFO", `Processing call ${i + 1}/${callIds.length} (attempt ${retryAttempt + 1})`, {
            call_id: callId,
          });

          // Check if already populated
          const alreadyPopulated = await checkIfDerivedTablesPopulated(callId);
          if (alreadyPopulated) {
            log("INFO", "Call already has derived tables, skipping");
            checkpoint.processed_count++;
            checkpoint.success_count++;
            success = true;
            break;
          }

          // Invoke orchestrator
          const result = await invokeOrchestrator(callId, process.env.SERVICE_USER_ID || "service-account");

          if (result.success) {
            log("INFO", "✓ Call processed successfully");
            checkpoint.processed_count++;
            checkpoint.success_count++;
            success = true;
          } else {
            error = result.error;
            log("WARN", `✗ Call processing failed: ${error}`);
            retryAttempt++;

            if (retryAttempt < RETRY_COUNT) {
              const backoffMs = Math.pow(2, retryAttempt) * 1000;
              log("INFO", `Retrying in ${backoffMs}ms...`);
              await delay(backoffMs);
            }
          }
        } catch (err) {
          error = err.message;
          log("ERROR", `Unexpected error: ${error}`);
          retryAttempt++;

          if (retryAttempt < RETRY_COUNT) {
            const backoffMs = Math.pow(2, retryAttempt) * 1000;
            log("INFO", `Retrying in ${backoffMs}ms...`);
            await delay(backoffMs);
          }
        }
      }

      if (!success) {
        checkpoint.failed_count++;
        checkpoint.failed_calls.push({
          call_id: callId,
          error: error,
          retry_count: retryAttempt,
        });
        log("ERROR", `Failed to process call after ${RETRY_COUNT} retries`, { call_id: callId });
      }
    }

    checkpoint.last_update = new Date().toISOString();
    checkpoint.call_index++;
  }

  // Calculate batch duration
  const batchDuration = Date.now() - batchStartTime;
  log("INFO", `Batch completed in ${batchDuration}ms`);

  return checkpoint;
}

async function main() {
  try {
    log("INFO", "=".repeat(60));
    log("INFO", "GrowthPlatform Backfill Runner - Starting");
    log("INFO", "=".repeat(60));

    log("INFO", "Configuration", {
      batch_size: BATCH_SIZE,
      rate_limit_per_min: RATE_LIMIT_PER_MIN,
      delay_between_batches_ms: DELAY_BETWEEN_BATCHES_MS,
      retry_count: RETRY_COUNT,
      timeout_sec: TIMEOUT_SEC,
      dry_run: dryRun,
    });

    // Load or create checkpoint
    let checkpoint = loadCheckpoint() || {
      total_calls: 0,
      batch_number: 0,
      call_index: 0,
      processed_count: 0,
      success_count: 0,
      failed_count: 0,
      failed_calls: [],
      start_time: new Date().toISOString(),
      last_update: new Date().toISOString(),
      status: "running",
    };

    if (resumeMode || dryRun) {
      log("INFO", "Loading existing checkpoint");
    }

    // Fetch all call IDs
    log("INFO", "Fetching all call IDs from database...");
    const allCallIds = await getAllCallIds();
    checkpoint.total_calls = allCallIds.length;
    log("INFO", `Found ${allCallIds.length} calls to process`);

    // Determine starting point
    let startIndex = checkpoint.call_index || (startFrom - 1);
    if (retryFailedOnly) {
      log("INFO", `Retrying ${checkpoint.failed_calls.length} failed calls`);
      // Will process only failed calls below
    } else if (checkpoint.processed_count > 0 && !dryRun) {
      log("INFO", `Resuming from call index ${startIndex}`);
    }

    // Main processing loop
    let callIndex = startIndex;
    while (callIndex < allCallIds.length) {
      // Determine which calls to process in this batch
      let batchCallIds;

      if (retryFailedOnly && checkpoint.failed_calls.length > 0) {
        // Take up to BATCH_SIZE failed calls
        const failedIds = checkpoint.failed_calls.slice(0, BATCH_SIZE).map((f) => f.call_id);
        batchCallIds = failedIds;
        checkpoint.failed_calls = checkpoint.failed_calls.slice(BATCH_SIZE);
      } else {
        // Normal batch from call list
        const endIndex = Math.min(callIndex + BATCH_SIZE, allCallIds.length);
        batchCallIds = allCallIds.slice(callIndex, endIndex);
        callIndex = endIndex;
      }

      if (batchCallIds.length === 0) break;

      checkpoint.batch_number++;
      log("INFO", `\n--- Batch ${checkpoint.batch_number} ---`);
      log("INFO", `Processing ${batchCallIds.length} calls`, {
        processed_so_far: checkpoint.processed_count,
        success: checkpoint.success_count,
        failed: checkpoint.failed_count,
      });

      // Process batch
      checkpoint = await processCallBatch(batchCallIds, checkpoint);

      // Save checkpoint after each batch
      saveCheckpoint(checkpoint);

      // Rate limiting delay before next batch (if more batches to come)
      if (callIndex < allCallIds.length && !retryFailedOnly) {
        log("INFO", `Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    // Final status
    checkpoint.status = "completed";
    checkpoint.last_update = new Date().toISOString();
    saveCheckpoint(checkpoint);

    log("INFO", "\n" + "=".repeat(60));
    log("INFO", "BACKFILL COMPLETED");
    log("INFO", "=".repeat(60));
    log("INFO", "Summary", {
      total_calls: checkpoint.total_calls,
      processed: checkpoint.processed_count,
      success: checkpoint.success_count,
      failed: checkpoint.failed_count,
      success_rate: `${((checkpoint.success_count / checkpoint.processed_count) * 100).toFixed(1)}%`,
      batches: checkpoint.batch_number,
      duration_sec: Math.round(
        (new Date(checkpoint.last_update).getTime() - new Date(checkpoint.start_time).getTime()) /
          1000
      ),
    });

    if (checkpoint.failed_count > 0) {
      log("WARN", `${checkpoint.failed_count} calls failed. Review them for manual retry.`);
      log("INFO", "Failed calls saved to checkpoint for --retry-failed mode");
    }

    process.exit(checkpoint.failed_count === 0 ? 0 : 1);
  } catch (error) {
    log("ERROR", "Backfill process failed", error);
    process.exit(1);
  }
}

main();
