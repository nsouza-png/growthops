/* eslint-disable no-console */
/**
 * Exports GrowthPlatform schema to snapshots/ for diff after deploy.
 *
 * Requires Supabase CLI and a linked project (or pass --file-only to copy baseline only).
 *
 * Usage:
 *   node scripts/snapshot-gp-schema.js           → tries: npx supabase db dump --linked ...
 *   node scripts/snapshot-gp-schema.js --file-only → copies baseline migration to snapshots/
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = process.cwd()
const snapshotsDir = path.join(root, 'snapshots')
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const outFile = path.join(snapshotsDir, `GrowthPlatform-schema-${stamp}.sql`)
const fileOnly = process.argv.includes('--file-only')

fs.mkdirSync(snapshotsDir, { recursive: true })

const baseline = path.join(root, 'supabase', 'migrations', '20260426010000_baseline_canonical.sql')

if (fileOnly) {
  if (!fs.existsSync(baseline)) {
    console.error('Baseline migration not found:', baseline)
    process.exit(1)
  }
  const dest = path.join(snapshotsDir, `baseline-canonical-copy-${stamp}.sql`)
  fs.copyFileSync(baseline, dest)
  console.log('[snapshot] file-only →', dest)
  console.log('[snapshot] For live remote dump: supabase link + npx supabase db dump --linked --schema GrowthPlatform -f snapshots/...')
  process.exit(0)
}

const res = spawnSync(
  'npx',
  ['supabase', 'db', 'dump', '--linked', '--schema', 'GrowthPlatform', '-f', outFile],
  { cwd: root, stdio: 'inherit', shell: true, env: process.env },
)

if (res.status !== 0) {
  console.warn('[snapshot] dump failed — writing baseline copy as fallback')
  console.warn(
    '[snapshot] Common causes: Docker Desktop not running (Supabase CLI uses it for db dump on Windows), or CLI auth/link issues.',
  )
  console.warn('[snapshot] Baseline-only (no live dump): npm run snapshot:schema')
  if (fs.existsSync(baseline)) {
    fs.copyFileSync(baseline, path.join(snapshotsDir, `baseline-fallback-${stamp}.sql`))
  }
  process.exit(res.status || 1)
}

console.log('[snapshot] PASS →', outFile)
