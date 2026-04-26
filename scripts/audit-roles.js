/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VALID_ROLES = new Set(['admin', 'coordenador', 'executivo'])

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'GrowthPlatform' },
})

function groupByEmail(items, getEmail) {
  const map = new Map()
  for (const item of items) {
    const email = String(getEmail(item) || '').trim().toLowerCase()
    if (!email) continue
    if (!map.has(email)) map.set(email, [])
    map.get(email).push(item)
  }
  return map
}

async function listAllAuthUsers() {
  const out = []
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users ?? []
    out.push(...users)
    if (users.length < perPage) break
    page += 1
  }
  return out
}

async function main() {
  const authUsers = await listAllAuthUsers()
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('id, user_id, role, email, is_active, onboarding_completed, created_at')

  if (rolesError) throw rolesError

  const roleRows = roles ?? []
  const authById = new Map(authUsers.map((u) => [u.id, u]))

  const usersWithoutRole = authUsers.filter((u) => !roleRows.some((r) => r.user_id === u.id))
  const invalidRoles = roleRows.filter((r) => !VALID_ROLES.has(String(r.role || '').trim().toLowerCase()))

  const roleByEmail = groupByEmail(roleRows, (r) => r.email)
  const authByEmail = groupByEmail(authUsers, (u) => u.email)
  const duplicateRoleEmails = [...roleByEmail.entries()].filter(([, arr]) => arr.length > 1)
  const duplicateAuthEmails = [...authByEmail.entries()].filter(([, arr]) => arr.length > 1)

  const danglingRoleRows = roleRows.filter((r) => r.user_id && !authById.has(r.user_id))

  const pass =
    usersWithoutRole.length === 0 &&
    invalidRoles.length === 0 &&
    duplicateRoleEmails.length === 0 &&
    duplicateAuthEmails.length === 0 &&
    danglingRoleRows.length === 0

  const report = {
    summary: {
      total_auth_users: authUsers.length,
      total_user_roles_rows: roleRows.length,
      users_without_role: usersWithoutRole.length,
      invalid_roles: invalidRoles.length,
      duplicate_role_emails: duplicateRoleEmails.length,
      duplicate_auth_emails: duplicateAuthEmails.length,
      dangling_role_rows: danglingRoleRows.length,
      go_live_status: pass ? 'PASS' : 'FAIL',
    },
    users_without_role: usersWithoutRole.map((u) => ({
      user_id: u.id,
      email: u.email || null,
      created_at: u.created_at || null,
    })),
    invalid_roles: invalidRoles.map((r) => ({
      row_id: r.id,
      user_id: r.user_id,
      email: r.email || null,
      role: r.role || null,
    })),
    duplicate_role_emails: duplicateRoleEmails.map(([email, arr]) => ({
      email,
      count: arr.length,
      rows: arr.map((r) => ({ id: r.id, user_id: r.user_id, role: r.role })),
    })),
    duplicate_auth_emails: duplicateAuthEmails.map(([email, arr]) => ({
      email,
      count: arr.length,
      users: arr.map((u) => ({ id: u.id, created_at: u.created_at || null })),
    })),
    dangling_role_rows: danglingRoleRows.map((r) => ({
      row_id: r.id,
      user_id: r.user_id,
      email: r.email || null,
      role: r.role || null,
    })),
  }

  console.log(JSON.stringify(report, null, 2))
  process.exit(pass ? 0 : 2)
}

function missingGrowthPlatformSchema(err) {
  const code = err?.code
  const msg = String(err?.message || err || '')
  return code === '42P01' || /GrowthPlatform\.\w+.*does not exist/i.test(msg) || /relation.*does not exist/i.test(msg)
}

main().catch((err) => {
  if (missingGrowthPlatformSchema(err)) {
    console.error(
      '[audit-roles] FAIL: GrowthPlatform.user_roles (or related) missing — migrations likely not applied on this project.',
      '\nFix: apply canonical migrations to the linked DB, then re-run.',
    )
    process.exit(1)
  }
  console.error('[audit-roles] FAIL:', err?.message || err)
  process.exit(1)
})

