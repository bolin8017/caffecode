interface Badge {
  slug: string
  name: string
  icon: string
  category: string
  earned_at: string
}

const ICON_MAP: Record<string, string> = {
  coffee: '\u2615',
  book: '\u{1F4D8}',
  trophy: '\u{1F3C6}',
  fire: '\u{1F525}',
  lightning: '\u26A1',
  puzzle: '\u{1F9E9}',
  map: '\u{1F5FA}',
  sprout: '\u{1F331}',
}

interface Props {
  badges: Badge[]
}

export function BadgeShowcase({ badges }: Props) {
  if (badges.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
        <p className="text-sm">還沒有任何徽章</p>
        <p className="text-xs mt-1">持續解題，第一個徽章就在不遠處</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold mb-3">徽章 ({badges.length})</h2>
      <div className="flex flex-wrap gap-3">
        {badges.map(b => (
          <div
            key={b.slug}
            className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
            title={`獲得於 ${new Date(b.earned_at).toLocaleDateString('zh-TW')}`}
          >
            <span className="text-lg">{ICON_MAP[b.icon] ?? b.icon}</span>
            <span className="text-xs font-medium">{b.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
