export type GrowthStage = 0 | 1 | 2 | 3 | 4

export interface TopicLevel {
  stage: GrowthStage
  level: number            // 0 = pre-harvest, 1+ = post-harvest levels
  solvedCount: number
  nextMilestone: number    // solves needed for next stage/level
  progressInStage: number  // 0.0 - 1.0 within current stage or level
}

const LEVEL_INTERVAL = 5

export function computeTopicLevel(solvedCount: number): TopicLevel {
  if (solvedCount === 0)
    return { stage: 0, level: 0, solvedCount, nextMilestone: 1, progressInStage: 0 }
  if (solvedCount <= 2)
    return { stage: 1, level: 0, solvedCount, nextMilestone: 3, progressInStage: (solvedCount - 1) / 2 }
  if (solvedCount <= 5)
    return { stage: 2, level: 0, solvedCount, nextMilestone: 6, progressInStage: (solvedCount - 3) / 3 }
  if (solvedCount <= 10)
    return { stage: 3, level: 0, solvedCount, nextMilestone: 11, progressInStage: (solvedCount - 6) / 5 }

  // Stage 4 + uncapped levels: every LEVEL_INTERVAL solves = +1 level
  const beyondHarvest = solvedCount - 11
  const level = Math.floor(beyondHarvest / LEVEL_INTERVAL) + 1
  const currentLevelBase = 11 + (level - 1) * LEVEL_INTERVAL
  const nextMilestone = currentLevelBase + LEVEL_INTERVAL
  const progressInStage = (solvedCount - currentLevelBase) / LEVEL_INTERVAL

  return { stage: 4, level, solvedCount, nextMilestone, progressInStage }
}
