// apps/web/e2e/helpers/supabase.ts
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local so this helper works both in globalSetup and test files
function loadEnvLocal() {
  // Walk up from __dirname (e2e/helpers/) to find apps/web/.env.local
  const candidates = [
    path.resolve(__dirname, '..', '..', '.env.local'), // e2e/helpers -> e2e -> web
    path.resolve(process.cwd(), '.env.local'),          // fallback: cwd
  ]
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
    break
  }
}

loadEnvLocal()

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'E2E tests require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars',
  )
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export const TEST_USER_EMAIL = 'e2e-test-user@caffecode.net'
export const TEST_USER_PASSWORD = 'e2e-test-password-2026!'
export const TEST_ADMIN_EMAIL = 'e2e-test-admin@caffecode.net'
export const TEST_ADMIN_PASSWORD = 'e2e-test-admin-password-2026!'
export const TEST_FRESH_EMAIL = 'e2e-test-fresh@caffecode.net'
export const TEST_FRESH_PASSWORD = 'e2e-test-fresh-password-2026!'
