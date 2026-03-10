'use client'

import posthog from 'posthog-js'

function isReady() {
  return typeof window !== 'undefined' && posthog.__loaded
}

export function identifyUser(userId: string, email: string | null) {
  if (!isReady()) return
  posthog.identify(userId, { email: email ?? undefined })
}

export function trackSolveMarked(props: {
  problemId: number
  source: 'problem' | 'dashboard' | 'telegram'
  timeSinceSentSec: number | null
}) {
  if (!isReady()) return
  posthog.capture('problem_solve_marked', {
    problem_id: props.problemId,
    source: props.source,
    time_since_sent_sec: props.timeSinceSentSec,
  })
}

export function trackGardenVisited(props: {
  topicCount: number
  maxSolvedTopic: string | null
}) {
  if (!isReady()) return
  posthog.capture('garden_visited', {
    topic_count: props.topicCount,
    max_solved_topic: props.maxSolvedTopic,
  })
}
