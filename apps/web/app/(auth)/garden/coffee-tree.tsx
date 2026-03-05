import { topicLabel, topicToVariety } from '@caffecode/shared'
import type { GrowthStage } from '@caffecode/shared'

const STAGE_CONFIG: Record<GrowthStage, { emoji: string; label: string }> = {
  0: { emoji: '\u{1F331}', label: 'Seed' },
  1: { emoji: '\u{1F33F}', label: 'Sprout' },
  2: { emoji: '\u{1F333}', label: 'Small Tree' },
  3: { emoji: '\u{1F332}', label: 'Big Tree' },
  4: { emoji: '\u2615', label: 'Harvest' },
}

interface Props {
  topic: string
  stage: GrowthStage
  level: number
  solvedCount: number
  totalReceived: number
  progressInStage: number
}

export function CoffeeTree({ topic, stage, level, solvedCount, totalReceived, progressInStage }: Props) {
  const config = STAGE_CONFIG[stage]
  const variety = topicToVariety(topic)
  const label = topicLabel(topic)

  // Overall progress: stages 0-3 map to 0-75%, stage 4 = 75% + progressInStage * 25%
  const overallProgress = stage < 4
    ? (stage / 4) * 100 + (progressInStage * 25)
    : 100

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:shadow-md">
      <div className="relative">
        <span className="text-4xl leading-none" role="img" aria-label={config.label}>
          {config.emoji}
        </span>
        {level > 0 && (
          <span className="absolute -top-1 -right-3 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-200">
            Lv.{level}
          </span>
        )}
      </div>
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
            style={{ width: `${Math.round(overallProgress)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
