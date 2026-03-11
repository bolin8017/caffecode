// apps/web/e2e/global-setup.ts
import { chromium, type FullConfig } from '@playwright/test'
import {
  supabaseAdmin,
  TEST_USER_EMAIL,
  TEST_USER_PASSWORD,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_FRESH_EMAIL,
  TEST_FRESH_PASSWORD,
} from './helpers/supabase'

async function ensureTestUser(
  email: string,
  password: string,
  opts?: { isAdmin?: boolean; onboardingCompleted?: boolean },
) {
  // Try to create user first; if already exists, find and update
  let userId: string

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (created?.user) {
    userId = created.user.id
  } else if (createError?.message?.includes('already been registered')) {
    // User exists — find by listing (with high perPage to avoid pagination issues)
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const existing = existingUsers?.users?.find(u => u.email === email)
    if (!existing) throw new Error(`User ${email} exists but not found in listUsers`)
    userId = existing.id
    await supabaseAdmin.auth.admin.updateUserById(userId, { password })
  } else {
    throw new Error(`Failed to create test user ${email}: ${createError?.message}`)
  }

  // Set user profile flags
  const updates: Record<string, unknown> = {}
  if (opts?.isAdmin !== undefined) updates.is_admin = opts.isAdmin
  if (opts?.onboardingCompleted !== undefined)
    updates.onboarding_completed = opts.onboardingCompleted

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabaseAdmin.from('users').update(updates).eq('id', userId)
    if (updateError) throw new Error(`Failed to update profile for ${email}: ${updateError.message}`)
  }

  return userId
}

async function loginAndSaveState(
  email: string,
  password: string,
  storageStatePath: string,
  baseURL: string,
) {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  // Sign in via Supabase REST API to get session tokens
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(`Failed to sign in as ${email}: ${error?.message ?? 'no session'}`)
  }

  const session = data.session
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]

  // Navigate to the app to establish a domain context for cookies
  await page.goto(baseURL)
  await page.waitForLoadState('domcontentloaded')

  // Set the Supabase auth cookie that @supabase/ssr reads server-side.
  // The cookie name format is: sb-<projectRef>-auth-token
  // The value is a JSON-encoded session object, possibly chunked.
  // We set the full session as-is (ssr will read the auth-token cookie).
  const cookieName = `sb-${projectRef}-auth-token`
  const cookieValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  })

  // Supabase SSR chunks large cookies; handle by setting cookie directly
  const maxChunkSize = 3180
  if (cookieValue.length <= maxChunkSize) {
    await context.addCookies([
      {
        name: cookieName,
        value: cookieValue,
        domain: new URL(baseURL).hostname,
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ])
  } else {
    // Chunk the cookie value for large sessions
    const chunks = []
    for (let i = 0; i * maxChunkSize < cookieValue.length; i++) {
      chunks.push(cookieValue.slice(i * maxChunkSize, (i + 1) * maxChunkSize))
    }
    await context.addCookies(
      chunks.map((chunk, i) => ({
        name: i === 0 ? cookieName : `${cookieName}.${i}`,
        value: chunk,
        domain: new URL(baseURL).hostname,
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
      })),
    )
  }

  // Reload to have the app pick up the cookies
  await page.goto(baseURL)
  await page.waitForLoadState('networkidle')

  await context.storageState({ path: storageStatePath })
  await browser.close()
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000'

  console.log('[E2E] Creating test users...')

  // Create test users
  await ensureTestUser(TEST_USER_EMAIL, TEST_USER_PASSWORD, {
    isAdmin: false,
    onboardingCompleted: true,
  })
  await ensureTestUser(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, {
    isAdmin: true,
    onboardingCompleted: true,
  })
  await ensureTestUser(TEST_FRESH_EMAIL, TEST_FRESH_PASSWORD, {
    isAdmin: false,
    onboardingCompleted: false,
  })

  console.log('[E2E] Saving auth states...')

  // Login each user and save browser state
  await loginAndSaveState(TEST_USER_EMAIL, TEST_USER_PASSWORD, 'e2e/.auth/user.json', baseURL)
  await loginAndSaveState(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, 'e2e/.auth/admin.json', baseURL)
  await loginAndSaveState(TEST_FRESH_EMAIL, TEST_FRESH_PASSWORD, 'e2e/.auth/fresh.json', baseURL)

  console.log('[E2E] Global setup complete.')
}
