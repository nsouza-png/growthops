/* eslint-disable no-console */
const { spawnSync } = require('child_process')

const root = process.cwd()
const appDir = `${root}\\app`
const checks = [
  { id: 'typecheck', cmd: 'npx', args: ['tsc', '--noEmit'], cwd: appDir },
  { id: 'unit_tests', cmd: 'npx', args: ['vitest', 'run'], cwd: appDir },
  {
    id: 'e2e_smoke',
    cmd: 'npx',
    args: [
      'playwright',
      'test',
      '--project=chromium',
      'tests/e2e/auth.spec.ts',
      'tests/e2e/performance-route.spec.ts',
      'tests/e2e/insights.spec.ts',
    ],
    cwd: appDir,
  },
  { id: 'dataset_validation', cmd: 'npm', args: ['run', 'validate:pdi-dataset'], cwd: root, allowExit2: true },
  {
    id: 'rag_dry_run',
    cmd: 'npm',
    args: ['run', 'rag:dry-run'],
    cwd: root,
    env: {
      RAG_SOURCE_DIR: 'C:\\Users\\n.souza_g4educacao\\Documents\\G4OS GROWTH OPS FULL\\estudos\\analises-calls\\analises',
    },
  },
]

let hasFailure = false
for (const check of checks) {
  console.log(`\n=== ${check.id} ===`)
  const res = spawnSync(check.cmd, check.args, {
    cwd: check.cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...(check.env || {}) },
  })
  const ok = res.status === 0 || (check.allowExit2 && res.status === 2)
  console.log(`[${check.id}] ${ok ? 'PASS' : 'FAIL'} (exit=${res.status})`)
  if (!ok) hasFailure = true
}

console.log(`\nPRE-FLIGHT RESULT: ${hasFailure ? 'FAIL' : 'PASS'}`)
process.exit(hasFailure ? 1 : 0)
