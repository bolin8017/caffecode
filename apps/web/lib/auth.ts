import { createClient } from '@/lib/supabase/server'

/**
 * Get the authenticated user or throw. Shared across Server Actions.
 */
export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  return { supabase, user }
}
