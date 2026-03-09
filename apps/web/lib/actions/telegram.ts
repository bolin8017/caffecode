'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { upsertChannel } from '@/lib/repositories/channel.repository'

export async function connectTelegram(): Promise<{ deepLink: string; linkToken: string }> {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  if (!botUsername) throw new Error('TELEGRAM_BOT_USERNAME is not configured')

  const { user } = await getAuthUser()

  const linkToken = crypto.randomUUID()
  const serviceClient = createServiceClient()

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min

  await upsertChannel(serviceClient, {
    user_id: user.id,
    channel_type: 'telegram',
    channel_identifier: '',
    display_label: null,
    is_verified: false,
    link_token: linkToken,
    link_token_expires_at: expiresAt,
  })

  // Do NOT revalidatePath here — that would re-render the page and wipe
  // the Client Component state (result) before the user can copy the token.
  // The channel list refreshes naturally on next page load after verification.

  return {
    deepLink: `https://t.me/${botUsername}?start=link_${linkToken}`,
    linkToken: `link_${linkToken}`,
  }
}
