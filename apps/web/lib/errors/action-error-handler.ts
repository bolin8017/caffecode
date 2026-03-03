import { logger } from '@/lib/logger'
import { AppError } from './app-error'

export function handleActionError(error: unknown): { error: string } {
  if (error instanceof AppError) {
    logger.warn({ code: error.code, message: error.message }, 'Action error')
    return { error: error.message }
  }
  logger.error({ error }, 'Unexpected action error')
  return { error: '發生未預期的錯誤，請稍後重試' }
}
