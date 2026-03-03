export interface PushMessage {
  title: string
  difficulty: string    // 'Easy' | 'Medium' | 'Hard'
  leetcodeId: number   // LeetCode problem number (e.g. 1 for Two Sum)
  explanation: string
  url: string
  problemSlug: string
  problemId: number
}

export interface SendResult {
  success: boolean
  error?: string
  shouldRetry: boolean
}

export interface SelectedProblem {
  problem_id: number
  leetcode_id: number
  slug: string
  title: string
  difficulty: string
  explanation: string
  // List mode only — used to advance current_position after delivery
  list_id?: number
  sequence_number?: number
}
