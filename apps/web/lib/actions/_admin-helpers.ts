/**
 * Shared helpers for admin Server Actions.
 *
 * `requireAdmin` centralises the auth + is_admin check.
 * `runAdminAction` wraps the common pattern of (require admin → run logic →
 * revalidate → mask errors) so individual actions only spell out their own
 * input validation and DB mutations.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface AdminContext {
  userId: string
  db: SupabaseClient
}

export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthenticated')

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profileError) {
    logger.error({ error: profileError, userId: user.id }, 'requireAdmin: profile query failed')
    throw new Error('Forbidden')
  }
  if (!profile?.is_admin) throw new Error('Forbidden')
  return { userId: user.id, db: await createServiceClient() }
}

export interface RunAdminActionOptions {
  /** Error message surfaced to the caller on any failure. Full error is logged server-side. */
  errorMessage: string
  /** Path to revalidate after a successful mutation. */
  revalidate?: string
  /** Additional log fields attached to the error log. */
  logContext?: Record<string, unknown>
}

/**
 * Run an admin-only handler with a centralised auth check, revalidation,
 * and error masking. Re-throws `Unauthenticated` / `Forbidden` unchanged
 * (so UI can show the right banner); masks every other error with
 * `options.errorMessage`.
 */
export async function runAdminAction<T>(
  action: string,
  handler: (ctx: AdminContext) => Promise<T>,
  options: RunAdminActionOptions,
): Promise<T> {
  const ctx = await requireAdmin()
  try {
    const result = await handler(ctx)
    if (options.revalidate) revalidatePath(options.revalidate)
    return result
  } catch (err) {
    logger.error(
      { error: String(err), action, ...options.logContext },
      `${action} failed`,
    )
    throw new Error(options.errorMessage)
  }
}
