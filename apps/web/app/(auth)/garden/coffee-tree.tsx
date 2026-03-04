import type { GrowthStage } from '@/lib/repositories/garden.repository'

const STAGE_CONFIG: Record<GrowthStage, {
  emoji: string
  label: string
}> = {
  0: { emoji: '🌱', label: '種子' },
  1: { emoji: '🌿', label: '幼苗' },
  2: { emoji: '🌳', label: '小樹' },
  3: { emoji: '🌲', label: '大樹' },
  4: { emoji: '☕', label: '結果' },
}

const TOPIC_TO_VARIETY: Record<string, string> = {
  'Array': '巴西日曬',
  'String': '哥倫比亞水洗',
  'Binary Search': '耶加雪菲',
  'Tree': '肯亞 AA',
  'Stack': '危地馬拉',
  'Queue': '危地馬拉',
  'Sliding Window': '巴拿馬',
  'Dynamic Programming': '牙買加藍山',
  'Graph': '藝伎 Geisha',
  'Two Pointers': '瓜地馬拉',
  'Hash Table': '蘇門答臘',
  'Heap (Priority Queue)': '衣索比亞',
  'Backtracking': '哥斯大黎加',
  'Greedy': '巴拿馬蜜處理',
  'Linked List': '盧安達',
  'Depth-First Search': '坦尚尼亞',
  'Breadth-First Search': '印尼曼特寧',
  'Math': '墨西哥',
  'Bit Manipulation': '祕魯',
  'Sorting': '夏威夷可那',
  'Union Find': '印度風漬',
  'Trie': '越南羅布斯塔',
  'Design': '義式濃縮',
  'Simulation': '冰滴咖啡',
  'Recursion': '土耳其咖啡',
  'Matrix': '摩卡',
  'Monotonic Stack': '冷萃咖啡',
  'Divide and Conquer': '虹吸式咖啡',
}

interface Props {
  topic: string
  stage: GrowthStage
  solvedCount: number
  totalReceived: number
}

export function CoffeeTree({ topic, stage, solvedCount, totalReceived }: Props) {
  const config = STAGE_CONFIG[stage]
  const variety = TOPIC_TO_VARIETY[topic] ?? '精品豆'

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:shadow-md">
      <span className="text-4xl leading-none" role="img" aria-label={config.label}>
        {config.emoji}
      </span>
      <div className="space-y-0.5">
        <p className="text-xs font-semibold">{topic}</p>
        <p className="text-[10px] text-muted-foreground">{variety}</p>
      </div>
      <div className="w-full">
        <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{config.label}</span>
          <span>{solvedCount} 解 / {totalReceived} 題</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${(stage / 4) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
