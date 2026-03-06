'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { deleteChannel } from '@/lib/repositories/channel.repository'

export async function disconnectChannel(channelId: string) {
  z.string().uuid().parse(channelId)
  const { supabase, user } = await getAuthUser()
  await deleteChannel(supabase, channelId, user.id)
  revalidatePath('/settings')
}
