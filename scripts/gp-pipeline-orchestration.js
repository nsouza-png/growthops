#!/usr/bin/env node

/**
 * gp-pipeline-orchestration.js
 * 
 * Cliente CLI para testar e monitorar o pipeline de orquestração GPT.
 * 
 * Usage:
 *   node gp-pipeline-orchestration.js --call-id <uuid> --user-id <uuid> [--parallel] [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "GrowthPlatform" } }
);

interface PipelineStatus {
  call_id: string;
  timestamp: string;
  stage: string;
  derived_tables: {
    call_analysis: boolean;
    behavior_signals: boolean;
    framework_scores: boolean;
    business_analysis: boolean;
    smart_alerts: number;
    call_followups: number;
    closer_pdis: boolean;
  };
}

async function validateCall(callId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("calls")
    .select("id, transcript_text, processing_status")
    .eq("id", callId)
    .single();

  if (error || !data) {
    console.error(`❌ Call not found: ${callId}`);
    return false;
  }

  if (!data.transcript_text) {
    console.error(`❌ Call has no transcript: ${callId}`);
    return false;
  }

  console.log(`✓ Call validated: ${callId} (status: ${data.processing_status})`);
  return true;
}

async function checkDerivedTablesStatus(callId: string): Promise<PipelineStatus> {
  const checks = {
    call_analysis: (await supabase
      .from("call_analysis")
      .select("id", { count: "exact" })
      .eq("call_id", callId)
      .single()).data !== null,

    behavior_signals: (await supabase
      .from("behavior_signals")
      .select("id", { count: "exact" })
      .eq("call_id", callId)
      .single()).data !== null,

    framework_scores: (await supabase
      .from("framework_scores")
      .select("id", { count: "exact" })
      .eq("call_id", callId)
      .single()).data !== null,

    business_analysis: (await supabase
      .from("business_analysis")
      .select("id", { count: "exact" })
      .eq("call_id", callId)
      .single()).data !== null,

    smart_alerts: (
      await supabase
        .from("smart_alerts")
        .select("id", { count: "exact" })
        .eq("call_id", callId)
    ).count || 0,

    call_followups: (
      await supabase
        .from("call_followups")
        .select("id", { count: "exact" })
        .eq("call_id", callId)
    ).count || 0,

    closer_pdis: (await supabase
      .from("closer_pdis")
      .select("id", { count: "exact" })
      .eq("call_id", callId)
      .single()).data !== null,
  };

  return {
    call_id: callId,
    timestamp: new Date().toISOString(),
    stage: "orchestration_complete",
    derived_tables: checks,
  };
}

async function triggerOrchestrationPipeline(
  callId: string,
  userId: string,
  parallelMode: boolean = true
): Promise<void> {
  console.log(`\n📊 Initiating Orchestration Pipeline...`);
  console.log(`   Call ID: ${callId}`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Parallel Mode: ${parallelMode}`);
  console.log(`\nPipeline sequence:`);
  console.log(`  [1] call_analysis (foundation)`);
  console.log(`  [2-4] PARALLEL: behavior_signals, framework_scores, business_analysis`);
  console.log(`  [5] smart_alerts (depends on 2-4)`);
  console.log(`  [6] call_followups (depends on 1)`);
  console.log(`  [7] closer_pdi (depends on 1,2,3,4)`);

  try {
    // Call the Supabase function
    const { data, error } = await supabase.functions.invoke(
      "gp-orchestrate-pipeline",
      {
        body: {
          call_id: callId,
          user_id: userId,
          parallel_mode: parallelMode,
        },
      }
    );

    if (error) {
      console.error(`\n❌ Pipeline invocation failed:`, error);
      throw error;
    }

    console.log(`\n✓ Pipeline triggered successfully`);
    console.log(`\nResults summary:`);
    Object.entries(data.results_summary).forEach(([table, status]) => {
      console.log(`  ${table}: ${status}`);
    });

    // Poll for completion
    console.log(`\n⏳ Monitoring pipeline execution...`);
    await monitorPipelineCompletion(callId, 60000); // 60 second timeout
  } catch (error) {
    console.error(`\n❌ Error triggering pipeline:`, error);
    throw error;
  }
}

async function monitorPipelineCompletion(
  callId: string,
  timeoutMs: number = 120000
): Promise<void> {
  const startTime = Date.now();
  const pollIntervalMs = 3000;

  while (Date.now() - startTime < timeoutMs) {
    const status = await checkDerivedTablesStatus(callId);

    const populated = Object.values(status.derived_tables).filter(
      (v) => v === true || (typeof v === "number" && v > 0)
    ).length;

    const total = 7; // 7 derived table categories
    const percentage = Math.round((populated / total) * 100);

    process.stdout.write(
      `\r  Progress: ${populated}/${total} tables populated (${percentage}%) `
    );

    if (populated === total) {
      console.log(`\n\n✅ Pipeline execution complete!\n`);
      printStatus(status);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  console.log(`\n\n⚠️  Timeout waiting for pipeline completion`);
  const finalStatus = await checkDerivedTablesStatus(callId);
  printStatus(finalStatus);
}

function printStatus(status: PipelineStatus): void {
  console.log(`📈 Pipeline Status Report`);
  console.log(`   Timestamp: ${status.timestamp}`);
  console.log(`\n   Derived Tables:`);

  const tables = status.derived_tables;
  console.log(
    `   ${tables.call_analysis ? "✓" : "✗"} call_analysis`
  );
  console.log(
    `   ${tables.behavior_signals ? "✓" : "✗"} behavior_signals`
  );
  console.log(
    `   ${tables.framework_scores ? "✓" : "✗"} framework_scores`
  );
  console.log(
    `   ${tables.business_analysis ? "✓" : "✗"} business_analysis`
  );
  console.log(
    `   ${tables.smart_alerts > 0 ? "✓" : "✗"} smart_alerts (${tables.smart_alerts} alerts)`
  );
  console.log(
    `   ${tables.call_followups > 0 ? "✓" : "✗"} call_followups (${tables.call_followups} followups)`
  );
  console.log(
    `   ${tables.closer_pdis ? "✓" : "✗"} closer_pdis`
  );
}

async function main() {
  const args = process.argv.slice(2);
  const callId = args.find((a) => a.startsWith("--call-id="))?.split("=")[1];
  const userId = args.find((a) => a.startsWith("--user-id="))?.split("=")[1];
  const parallelMode = !args.includes("--sequential");
  const dryRun = args.includes("--dry-run");

  if (!callId || !userId) {
    console.error(`Usage: node gp-pipeline-orchestration.js --call-id=<uuid> --user-id=<uuid> [--sequential] [--dry-run]`);
    process.exit(1);
  }

  console.log(`🚀 GrowthPlatform Pipeline Orchestration Client\n`);

  // Validate call exists and has transcript
  const isValid = await validateCall(callId);
  if (!isValid) {
    process.exit(1);
  }

  if (dryRun) {
    console.log(`\n📋 DRY RUN MODE - No changes will be made`);
    const status = await checkDerivedTablesStatus(callId);
    console.log(`\nCurrent status:`);
    printStatus(status);
    return;
  }

  // Trigger the pipeline
  await triggerOrchestrationPipeline(callId, userId, parallelMode);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
