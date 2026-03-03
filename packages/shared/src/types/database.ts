// DB row types — only types that are actively imported belong here.
// Query-specific subsets should use inline types at call sites.

export interface NotificationChannelRow {
  id: string
  user_id: string
  channel_type: 'telegram' | 'line' | 'email'
  channel_identifier: string
  display_label: string | null
  is_verified: boolean
  link_token: string | null
  consecutive_send_failures: number
  connected_at: string
  updated_at: string
}
