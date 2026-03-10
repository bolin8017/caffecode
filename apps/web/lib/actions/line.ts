'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { upsertChannel } from '@/lib/repositories/channel.repository'

export async function connectLine(): Promise<{ deepLink: string; linkToken: string }> {
  const botBasicId = process.env.LINE_BOT_BASIC_ID
  if (!botBasicId) throw new Error('LINE_BOT_BASIC_ID is not configured')

  const { user } = await getAuthUser()

  const linkToken = crypto.randomUUID()
  const serviceClient = createServiceClient()

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min

  try {
    await upsertChannel(serviceClient, {
      user_id: user.id,
      channel_type: 'line',
      channel_identifier: '',
      display_label: null,
      is_verified: false,
      link_token: linkToken,
      link_token_expires_at: expiresAt,
    })
  } catch (err) {
    const { logger } = await import('@/lib/logger')
    logger.error({ error: String(err), userId: user.id }, 'connectLine failed')
    throw new Error('LINE 連結失敗')
  }

  // Do NOT revalidatePath here — that would re-render the page and wipe
  // the Client Component state (result) before the user can copy the token.
  // The channel list refreshes naturally on next page load after verification.

  return {
    deepLink: `https://line.me/R/ti/p/${botBasicId}`,
    linkToken: `link_${linkToken}`,
  }
}
