'use client'

import { useEffect } from 'react'
import { identifyUser } from '@/lib/analytics'

interface Props {
  userId: string
  email: string | null
}

export function PostHogIdentify({ userId, email }: Props) {
  useEffect(() => {
    identifyUser(userId, email)
  }, [userId, email])
  return null
}
