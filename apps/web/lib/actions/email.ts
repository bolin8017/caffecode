'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'
import { upsertChannel } from '@/lib/repositories/channel.repository'

export async function connectEmail(): Promise<{ email: string }> {
  const { user } = await getAuthUser()
  if (!user.email) throw new Error('No email associated with this account')

  const serviceClient = createServiceClient()

  try {
    await upsertChannel(serviceClient, {
      user_id: user.id,
      channel_type: 'email',
      channel_identifier: user.email,
      display_label: null,
      is_verified: true,
      link_token: null,
    })
  } catch (err) {
    const { logger } = await import('@/lib/logger')
    logger.error({ error: String(err), userId: user.id }, 'connectEmail failed')
    throw new Error('Email 連結失敗')
  }

  revalidatePath('/settings')
  return { email: user.email }
}
