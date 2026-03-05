import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Get the authenticated user or throw. Shared across Server Actions.
 */
export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    logger.error({ error: error.message }, 'Auth user fetch failed')
  }
  if (!user) throw new Error('Unauthenticated')
  return { supabase, user }
}
