import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationChannelRow } from '@caffecode/shared'

/** Subset returned by getChannelsForUser (display-only fields). */
export type ChannelListItem = Pick<
  NotificationChannelRow,
  'id' | 'user_id' | 'channel_type' | 'display_label' | 'is_verified' | 'consecutive_send_failures' | 'connected_at'
>

export type { NotificationChannelRow }

export async function getChannelsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<ChannelListItem[]> {
  const { data, error } = await supabase
    .from('notification_channels')
    .select('id, user_id, channel_type, display_label, is_verified, consecutive_send_failures, connected_at')
    .eq('user_id', userId)
    .order('connected_at')
  if (error) throw new Error(`Failed to fetch channels: ${error.message}`)
  return (data ?? []) as ChannelListItem[]
}

export async function upsertChannel(
  supabase: SupabaseClient,
  data: {
    user_id: string
    channel_type: string
    channel_identifier: string
    display_label: string | null
    is_verified: boolean
    link_token: string | null
    link_token_expires_at?: string | null
  }
): Promise<void> {
  const { error } = await supabase
    .from('notification_channels')
    .upsert(data, { onConflict: 'user_id,channel_type' })
  if (error) throw new Error(`Failed to upsert channel: ${error.message}`)
}

export async function deleteChannel(
  supabase: SupabaseClient,
  channelId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('notification_channels')
    .delete()
    .eq('id', channelId)
    .eq('user_id', userId)
  if (error) throw new Error(`Failed to delete channel: ${error.message}`)
}

export async function verifyChannelByToken(
  supabase: SupabaseClient,
  linkToken: string,
  channelIdentifier: string,
  channelType?: string
): Promise<{ user_id: string } | null> {
  let query = supabase
    .from('notification_channels')
    .update({
      channel_identifier: channelIdentifier,
      is_verified: true,
      link_token: null,
      link_token_expires_at: null,
    })
    .eq('link_token', linkToken)
    .eq('is_verified', false)
    .gt('link_token_expires_at', new Date().toISOString())

  if (channelType) {
    query = query.eq('channel_type', channelType)
  }

  const { data, error } = await query.select('user_id').single()
  if (error || !data) return null
  return data
}
