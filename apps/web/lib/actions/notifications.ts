'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { deleteChannel } from '@/lib/repositories/channel.repository'

export async function disconnectChannel(channelId: string) {
  z.string().uuid().parse(channelId)
  const { supabase, user } = await getAuthUser()
  try {
    await deleteChannel(supabase, channelId, user.id)
  } catch (err) {
    const { logger } = await import('@/lib/logger')
    logger.error({ error: String(err), userId: user.id, channelId }, 'disconnectChannel failed')
    throw new Error('通知管道中斷失敗')
  }
  revalidatePath('/settings')
}
