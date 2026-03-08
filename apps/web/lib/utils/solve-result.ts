import { computeLevel, toStage } from '@/lib/repositories/garden.repository'
import type { TopicProficiency } from '@/lib/repositories/garden.repository'
import { topicToVariety } from '@caffecode/shared'
import type { Badge } from '@/lib/repositories/badge.repository'

export interface SolveResult {
  levelUps: Array<{
    topic: string
    variety: string
    oldLevel: number
    newLevel: number
    newStage: 0 | 1 | 2 | 3 | 4
  }>
  newBadges: Array<{
    name: string
    icon: string
  }>
  topicProgress: Array<{
    topic: string
    solvedCount: number
    nextThreshold: number
    level: number
  }>
}

/** Empty result for edge cases (already solved, concurrent race). */
export const EMPTY_SOLVE_RESULT: SolveResult = {
  levelUps: [],
  newBadges: [],
  topicProgress: [],
}

/** Given a current solved count, return the count needed to reach the next level. */
export function nextLevelThreshold(currentCount: number): number {
  const thresholds = [1, 3, 6, 11]
  for (const t of thresholds) {
    if (currentCount < t) return t
  }
  return 11 + Math.ceil((currentCount - 10) / 5) * 5
}

/**
 * Pure function: computes solve feedback from before-state + problem topics + badges.
 * Call BEFORE marking solved to capture the "before" proficiency.
 */
export function buildSolveResult(
  beforeTopics: TopicProficiency[],
  problemTopics: string[],
  newBadges: Badge[],
): SolveResult {
  const topicMap = new Map(beforeTopics.map(t => [t.topic, t]))

  const levelUps: SolveResult['levelUps'] = []
  const topicProgress: SolveResult['topicProgress'] = []

  for (const topic of problemTopics) {
    const before = topicMap.get(topic)
    const oldCount = before?.solvedCount ?? 0
    const newCount = oldCount + 1
    const oldLevel = computeLevel(oldCount)
    const newLevel = computeLevel(newCount)

    if (newLevel > oldLevel) {
      levelUps.push({
        topic,
        variety: topicToVariety(topic),
        oldLevel,
        newLevel,
        newStage: toStage(newCount),
      })
    }

    topicProgress.push({
      topic,
      solvedCount: newCount,
      nextThreshold: nextLevelThreshold(newCount),
      level: newLevel,
    })
  }

  return {
    levelUps,
    newBadges: newBadges.map(b => ({ name: b.name, icon: b.icon })),
    topicProgress,
  }
}
