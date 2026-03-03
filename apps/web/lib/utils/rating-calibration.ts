const SLIDER_MIN = 1000
const SLIDER_MAX = 2600

interface FeedbackSignal {
  difficulty: string
  rating: number
}

interface RatingRange {
  min: number
  max: number
}

export function computeSuggestedRange(feedbacks: FeedbackSignal[]): RatingRange | null {
  if (feedbacks.length < 5) return null

  const justRight = feedbacks.filter(f => f.difficulty === 'just_right').map(f => f.rating)
  const tooEasy   = feedbacks.filter(f => f.difficulty === 'too_easy').map(f => f.rating)
  const tooHard   = feedbacks.filter(f => f.difficulty === 'too_hard').map(f => f.rating)

  let min: number
  let max: number

  if (justRight.length >= 1) {
    min = Math.min(...justRight) - 100
    max = Math.max(...justRight) + 150
  } else {
    if (tooEasy.length === 0 || tooHard.length === 0) return null
    min = Math.max(...tooEasy) + 50
    max = Math.min(...tooHard) - 50
  }

  min = Math.max(SLIDER_MIN, min)
  max = Math.min(SLIDER_MAX, max)

  if (min >= max) return null

  return { min, max }
}
