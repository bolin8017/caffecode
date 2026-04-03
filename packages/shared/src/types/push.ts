export type Difficulty = 'Easy' | 'Medium' | 'Hard'
export type ChannelType = 'telegram' | 'line' | 'email'
export type LearningMode = 'list' | 'filter'

export interface PushMessage {
  title: string
  difficulty: Difficulty
  leetcodeId: number   // LeetCode problem number (e.g. 1 for Two Sum)
  explanation: string
  url: string
  problemSlug: string
  problemId: number
}

export type SendResult =
  | { success: true }
  | { success: false; error: string; shouldRetry: boolean }

export interface SelectedProblem {
  problem_id: number
  leetcode_id: number
  slug: string
  title: string
  difficulty: Difficulty
  explanation: string
  // List mode only — used to advance current_position after delivery
  list_id?: number
  sequence_number?: number
}
