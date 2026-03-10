import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { User } from '@supabase/supabase-js'

/**
 * Get the authenticated user or throw. Shared across Server Actions.
 */
export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    logger.error({ error: error.message }, 'Auth user fetch failed')
    throw new Error('Unauthenticated')
  }
  if (!user) throw new Error('Unauthenticated')
  return { supabase, user }
}

/**
 * Verify admin access for layouts/pages.
 * Uses cookie-aware client for auth, service_role client for DB query.
 */
export type AdminGuardResult =
  | { authorized: true; user: User }
  | { authorized: false; redirectTo: '/login' | '/dashboard' }

export async function verifyAdminAccess(): Promise<AdminGuardResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { authorized: false, redirectTo: '/login' }

  const serviceClient = createServiceClient()
  const { data: dbProfile } = await serviceClient
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!dbProfile?.is_admin) return { authorized: false, redirectTo: '/dashboard' }
  return { authorized: true, user }
}
