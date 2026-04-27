#!/usr/bin/env node

/**
 * gp-pipeline-e2e-test.js
 * 
 * End-to-end test for the GPT pipeline orchestration.
 * Tests all 7 stages and validates derived table population.
 * 
 * Usage:
 *   E2E_TEST_CALL_ID=<uuid> node gp-pipeline-e2e-test.js
 *   E2E_TEST_USER_ID=<uuid> node gp-pipeline-e2e-test.js (optional, defaults to SERVICE_ACCOUNT)
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "GrowthPlatform" } }
);

// Get test IDs from env or use defaults
const E2E_CALL_ID = process.env.E2E_RAG_CALL_ID || process.env.E2E_TEST_CALL_ID;
const E2E_USER_ID = process.env.E2E_TEST_USER_ID || "00000000-0000-4000-8000-000000000000";

interface TestResult {
  stage: string;
  status: "pass" | "fail" | "skip";
  message: string;
  duration_ms?: number;
  details?: any;
}

const results: TestResult[] = [];

function log(level: string, message: string, details?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}${details ? ` ${JSON.stringify(details)}` : ""}`);
}

async function testStage(
  stageName: string,
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  try {
    await testFn();
    results.push({
      stage: stageName,
      status: "pass",
      message: "✓ Stage passed",
      duration_ms: Date.now() - startTime,
    });
    log("INFO", `✓ ${stageName} passed`, { duration_ms: Date.now() - startTime });
  } catch (error) {
    results.push({
      stage: stageName,
      status: "fail",
      message: `✗ ${error.message}`,
      duration_ms: Date.now() - startTime,
      details: error,
    });
    log("ERROR", `✗ ${stageName} failed`, error.message);
  }
}

async function testCallExists() {
  const { data, error } = await supabase
    .from("calls")
    .select("id, transcript_text, seller_email")
    .eq("id", E2E_CALL_ID)
    .single();

  if (error || !data) throw new Error(`Call not found: ${E2E_CALL_ID}`);
  if (!data.transcript_text) throw new Error("Call has no transcript");

  log("INFO", "Call validated", { seller: data.seller_email });
}

async function testCallAnalysisPopulated() {
  const { data, error } = await supabase
    .from("call_analysis")
    .select("*")
    .eq("call_id", E2E_CALL_ID)
    .single();

  if (error || !data) {
    throw new Error("call_analysis not populated");
  }

  if (!data.summary_text) throw new Error("Missing summary_text");
  if (!data.client_pains) throw new Error("Missing client_pains");
  if (!data.talk_ratio_seller) throw new Error("Missing talk_ratio_seller");

  log("INFO", "call_analysis validated", {
    summary: data.summary_text.substring(0, 60) + "...",
    pains_count: data.client_pains.length,
    talk_ratio: data.talk_ratio_seller,
  });
}

async function testBehaviorSignalsPopulated() {
  const { data, error } = await supabase
    .from("behavior_signals")
    .select("*")
    .eq("call_id", E2E_CALL_ID)
    .single();

  if (error || !data) {
    throw new Error("behavior_signals not populated");
  }

  if (!data.signals_detected) throw new Error("Missing signals_detected");

  log("INFO", "behavior_signals validated", {
    methodologies: data.signals_detected.methodology_detected?.length || 0,
  });
}

async function testFrameworkScoresPopulated() {
  const { data, error } = await supabase
    .from("framework_scores")
    .select("*")
    .eq("call_id", E2E_CALL_ID)
    .single();

  if (error || !data) {
    throw new Error("framework_scores not populated");
  }

  if (!data.spiced_situation) throw new Error("Missing SPICED scores");
  if (!data.spin_situation) throw new Error("Missing SPIN scores");
  if (!data.challenger_insight) throw new Error("Missing CHALLENGER scores");

  log("INFO", "framework_scores validated", {
    spiced_total: data.spiced_total,
    spin_total: data.spin_total,
    challenger_total: data.challenger_total,
  });
}

async function testBusinessAnalysisPopulated() {
  const { data, error } = await supabase
    .from("business_analysis")
    .select("*")
    .eq("call_id", E2E_CALL_ID)
    .single();

  if (error || !data) {
    throw new Error("business_analysis not populated");
  }

  if (!data.analysis_data) throw new Error("Missing analysis_data");
  if (!data.deal_advancement) throw new Error("Missing deal_advancement");

  log("INFO", "business_analysis validated", {
    advancement: data.deal_advancement,
    roi_potential: data.analysis_data.roi_potential,
  });
}

async function testSmartAlertsPopulated() {
  const { data, error, count } = await supabase
    .from("smart_alerts")
    .select("*", { count: "exact" })
    .eq("call_id", E2E_CALL_ID);

  if (error) throw error;

  if (!count || count === 0) {
    throw new Error("No smart alerts generated");
  }

  log("INFO", "smart_alerts validated", {
    alert_count: count,
    types: [...new Set(data.map((a) => a.alert_type))],
  });
}

async function testCallFollowupsPopulated() {
  const { data, error, count } = await supabase
    .from("call_followups")
    .select("*", { count: "exact" })
    .eq("call_id", E2E_CALL_ID);

  if (error) throw error;

  if (!count || count === 0) {
    throw new Error("No followups generated");
  }

  log("INFO", "call_followups validated", {
    followup_count: count,
    types: [...new Set(data.map((a) => a.followup_type))],
  });
}

async function testCloserPDIPopulated() {
  const { data, error } = await supabase
    .from("closer_pdis")
    .select("*")
    .eq("call_id", E2E_CALL_ID)
    .single();

  if (error || !data) {
    throw new Error("closer_pdis not populated");
  }

  if (!data.pdi_data) throw new Error("Missing pdi_data");
  if (!data.overall_performance) throw new Error("Missing overall_performance");

  log("INFO", "closer_pdis validated", {
    performance: data.overall_performance,
    focus_framework: data.focus_framework,
  });
}

async function testPipelineCompletion() {
  const { data, error } = await supabase
    .from("calls")
    .select("processing_status, processing_stage")
    .eq("id", E2E_CALL_ID)
    .single();

  if (error || !data) throw new Error("Call status not found");

  if (data.processing_status !== "completed") {
    throw new Error(`Expected status 'completed', got '${data.processing_status}'`);
  }

  if (data.processing_stage !== "all_derived_tables_populated") {
    throw new Error(
      `Expected stage 'all_derived_tables_populated', got '${data.processing_stage}'`
    );
  }

  log("INFO", "Pipeline completion validated", {
    status: data.processing_status,
    stage: data.processing_stage,
  });
}

function printSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("E2E TEST SUMMARY");
  console.log("=".repeat(60) + "\n");

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;

  results.forEach((r) => {
    const symbol = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "○";
    console.log(
      `${symbol} ${r.stage.padEnd(30)} ${r.message.padEnd(40)} ${r.duration_ms ? r.duration_ms + "ms" : ""}`
    );
  });

  console.log(`\n${"Passed:".padEnd(40)} ${passed}/${results.length}`);
  console.log(`${"Failed:".padEnd(40)} ${failed}/${results.length}`);
  console.log(`${"Skipped:".padEnd(40)} ${skipped}/${results.length}`);

  const totalDuration = results.reduce((sum, r) => sum + (r.duration_ms || 0), 0);
  console.log(`${"Total Duration:".padEnd(40)} ${totalDuration}ms`);

  const passRate = ((passed / results.length) * 100).toFixed(1);
  console.log(`${"Pass Rate:".padEnd(40)} ${passRate}%`);

  console.log("\n" + "=".repeat(60));

  if (failed === 0) {
    console.log("✓ ALL TESTS PASSED - Pipeline is working correctly!");
    return 0;
  } else {
    console.log(`✗ ${failed} test(s) failed - Review logs above`);
    return 1;
  }
}

async function main() {
  if (!E2E_CALL_ID) {
    console.error("ERROR: E2E_TEST_CALL_ID environment variable not set");
    console.error("Usage: E2E_TEST_CALL_ID=<uuid> node gp-pipeline-e2e-test.js");
    process.exit(1);
  }

  log("INFO", "Starting E2E tests for GPT Pipeline Orchestration");
  log("INFO", "Configuration", {
    call_id: E2E_CALL_ID,
    user_id: E2E_USER_ID,
  });

  console.log("\n");

  // Run all tests
  await testStage("Call Exists & Has Transcript", testCallExists);
  await testStage("call_analysis Populated", testCallAnalysisPopulated);
  await testStage("behavior_signals Populated", testBehaviorSignalsPopulated);
  await testStage("framework_scores Populated", testFrameworkScoresPopulated);
  await testStage("business_analysis Populated", testBusinessAnalysisPopulated);
  await testStage("smart_alerts Populated", testSmartAlertsPopulated);
  await testStage("call_followups Populated", testCallFollowupsPopulated);
  await testStage("closer_pdis Populated", testCloserPDIPopulated);
  await testStage("Pipeline Completion Status", testPipelineCompletion);

  const exitCode = printSummary();
  process.exit(exitCode);
}

main();
