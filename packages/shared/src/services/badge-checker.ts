export interface UserBadgeContext {
  totalSolves: number
  currentStreak: number
  topicLevels: { topic: string; level: number }[]
  topicCount: number    // distinct topics with >= 1 solve
}

export type BadgeRequirement =
  | { type: 'total_solves'; threshold: number }
  | { type: 'streak'; threshold: number }
  | { type: 'topic_level'; topic: string; threshold: number }
  | { type: 'topic_count'; threshold: number }

export function evaluateBadgeCondition(req: BadgeRequirement, ctx: UserBadgeContext): boolean {
  switch (req.type) {
    case 'total_solves':
      return ctx.totalSolves >= req.threshold
    case 'streak':
      return ctx.currentStreak >= req.threshold
    case 'topic_level': {
      const tl = ctx.topicLevels.find(t => t.topic === req.topic)
      return (tl?.level ?? 0) >= req.threshold
    }
    case 'topic_count':
      return ctx.topicCount >= req.threshold
    default:
      return false
  }
}
