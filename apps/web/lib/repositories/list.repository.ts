import type { SupabaseClient } from '@supabase/supabase-js'

export interface ActiveListProgress {
  current_position: number
  curated_lists: {
    id: number
    name: string
    slug: string
    problem_count: number
  } | null
}

export async function getActiveListProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<ActiveListProgress | null> {
  const { data, error } = await supabase
    .from('user_list_progress')
    .select('current_position, curated_lists(id, name, slug, problem_count)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(`Failed to fetch active list progress: ${error.message}`)
  return data as unknown as ActiveListProgress | null
}

export async function deactivateAllLists(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_list_progress')
    .update({ is_active: false })
    .eq('user_id', userId)
  if (error) throw new Error(`Failed to deactivate lists: ${error.message}`)
}

export async function upsertListProgress(
  supabase: SupabaseClient,
  data: {
    user_id: string
    list_id: number
    is_active: boolean
    current_position?: number
  }
): Promise<void> {
  const { error } = await supabase
    .from('user_list_progress')
    .upsert(data, { onConflict: 'user_id,list_id' })
  if (error) throw new Error(`Failed to upsert list progress: ${error.message}`)
}
