import { topicLabel, topicToVariety } from '@caffecode/shared'
import type { GrowthStage } from '@/lib/repositories/garden.repository'

const STAGE_CONFIG: Record<GrowthStage, { emoji: string; label: string }> = {
  0: { emoji: '\u{1F331}', label: 'Seed' },
  1: { emoji: '\u{1F33F}', label: 'Sprout' },
  2: { emoji: '\u{1F333}', label: 'Small Tree' },
  3: { emoji: '\u{1F332}', label: 'Big Tree' },
  4: { emoji: '\u2615', label: 'Harvest' },
}

function progressPercent(solvedCount: number): number {
  const thresholds = [0, 1, 3, 6, 11]
  if (solvedCount >= 11) return 100
  let stage = 0
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (solvedCount >= thresholds[i]) { stage = i; break }
  }
  const lo = thresholds[stage]
  const hi = thresholds[stage + 1]
  const base = (stage / 4) * 100
  const fraction = ((solvedCount - lo) / (hi - lo)) * 25
  return Math.round(base + fraction)
}

interface Props {
  topic: string
  stage: GrowthStage
  solvedCount: number
  totalReceived: number
}

export function CoffeeTree({ topic, stage, solvedCount, totalReceived }: Props) {
  const config = STAGE_CONFIG[stage]
  const variety = topicToVariety(topic)
  const label = topicLabel(topic)

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:shadow-md">
      <span className="text-4xl leading-none" role="img" aria-label={config.label}>
        {config.emoji}
      </span>
      <div className="space-y-0.5">
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[10px] text-muted-foreground">{variety}</p>
      </div>
      <div className="w-full">
        <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{config.label}</span>
          <span>{solvedCount} / {totalReceived}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progressPercent(solvedCount)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
