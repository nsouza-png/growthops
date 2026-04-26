/* eslint-disable no-console */
const { spawnSync } = require('child_process')

const root = process.cwd()
const appDir = `${root}\\app`

function runNode(scriptRel) {
  return spawnSync('node', [scriptRel], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })
}

console.log('\n=== release_env ===')
let res = runNode('scripts/check-release-env.js')
if (res.status !== 0) process.exit(1)
console.log('[release_env] PASS')

const checks = [
  { id: 'typecheck', cmd: 'npx', args: ['tsc', '--noEmit'], cwd: appDir },
  { id: 'unit_tests', cmd: 'npx', args: ['vitest', 'run'], cwd: appDir },
  { id: 'rag_guardrails', cmd: 'npm', args: ['run', 'test:rag-guardrails'], cwd: root },
  { id: 'enrich_lock_idempotency', cmd: 'npm', args: ['run', 'test:enrich-lock'], cwd: root },
  { id: 'dataset_validation', cmd: 'npm', args: ['run', 'validate:pdi-dataset'], cwd: root, allowExit2: true },
  {
    id: 'rag_dry_run',
    cmd: 'npm',
    args: ['run', 'rag:dry-run'],
    cwd: root,
    env: {
      RAG_SOURCE_DIR:
        process.env.RAG_SOURCE_DIR ||
        'C:\\Users\\n.souza_g4educacao\\Documents\\G4OS GROWTH OPS FULL\\estudos\\analises-calls\\analises',
    },
  },
  {
    id: 'rag_runtime_e2e',
    cmd: 'node',
    args: ['scripts/validate-rag-pipeline-runtime.js'],
    cwd: root,
  },
  {
    id: 'e2e_release',
    cmd: 'npx',
    args: ['playwright', 'test', '--project=chromium', 'tests/e2e/authenticated'],
    cwd: appDir,
  },
]

let hasFailure = false
for (const check of checks) {
  console.log(`\n=== ${check.id} ===`)
  const r = spawnSync(check.cmd, check.args, {
    cwd: check.cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...(check.env || {}) },
  })
  const ok = r.status === 0 || (check.allowExit2 && r.status === 2)
  console.log(`[${check.id}] ${ok ? 'PASS' : 'FAIL'} (exit=${r.status})`)
  if (!ok) hasFailure = true
}

console.log(`\nPRE-FLIGHT RELEASE: ${hasFailure ? 'FAIL' : 'PASS'}`)
process.exit(hasFailure ? 1 : 0)
