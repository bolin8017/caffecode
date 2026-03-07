'use client'

import posthog from 'posthog-js'

export function identifyUser(userId: string, email: string | null) {
  if (typeof window === 'undefined') return
  posthog.identify(userId, { email: email ?? undefined })
}

export function trackNotificationClicked(props: {
  channelType: 'telegram' | 'line' | 'email'
  problemId: number
  difficulty: string
}) {
  posthog.capture('notification_clicked', {
    channel_type: props.channelType,
    problem_id: props.problemId,
    difficulty: props.difficulty,
  })
}

export function trackSolveMarked(props: {
  problemId: number
  source: 'problem' | 'dashboard' | 'telegram'
  timeSinceSentSec: number | null
}) {
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
  posthog.capture('garden_visited', {
    topic_count: props.topicCount,
    max_solved_topic: props.maxSolvedTopic,
  })
}
