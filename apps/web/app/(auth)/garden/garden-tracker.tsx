'use client'

import { useEffect } from 'react'
import { trackGardenVisited } from '@/lib/analytics'

interface Props {
  topicCount: number
  maxSolvedTopic: string | null
}

export function GardenTracker({ topicCount, maxSolvedTopic }: Props) {
  useEffect(() => {
    trackGardenVisited({ topicCount, maxSolvedTopic })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- 只在 mount 時觸發一次
  return null
}
