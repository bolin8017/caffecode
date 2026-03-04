export function parseSolvedCallbackData(data: string): { problemId: number } | null {
  const match = data.match(/^solved:(\d+)$/)
  if (!match) return null
  return { problemId: parseInt(match[1], 10) }
}
