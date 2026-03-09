'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { completeOnboarding } from '@/lib/actions/onboarding'
import { EmailConnectButton } from '@/app/(auth)/settings/notifications/email-connect-button'

interface CuratedList { id: number; name: string; problem_count: number }

interface Props {
  lists: CuratedList[]
}

type Step = 1 | 2 | 3 | 4

export function OnboardingWizard({ lists }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [isPending, startTransition] = useTransition()

  // Accumulated data
  const [mode, setMode] = useState<'list' | 'filter' | null>(null)
  const [listId, setListId] = useState<number | null>(null)
  const [diffMin, setDiffMin] = useState(0)
  const [diffMax, setDiffMax] = useState(3000)
  const [timezone, setTimezone] = useState(
    typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'Asia/Taipei'
  )
  const [pushHour, setPushHour] = useState(8)

  const next = () => setStep((s) => Math.min(s + 1, 4) as Step)
  const back = () => setStep((s) => Math.max(s - 1, 1) as Step)

  const finish = () => {
    startTransition(() =>
      completeOnboarding({
        mode: mode ?? 'list',
        list_id: listId,
        difficulty_min: diffMin,
        difficulty_max: diffMax,
        timezone,
        push_hour: pushHour,
      })
    )
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium ${
                s < step
                  ? 'bg-primary text-primary-foreground'
                  : s === step
                  ? 'bg-primary/20 text-primary border border-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s < step ? '✓' : s}
            </div>
            {s < 4 && <div className={`h-px w-8 ${s < step ? 'bg-primary' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Mode selection */}
      {step === 1 && (
        <div>
          <h1 className="text-2xl font-bold mb-2">選擇學習模式</h1>
          <p className="text-muted-foreground mb-8">你想怎麼刷題？</p>
          <div className="grid gap-4">
            <button
              onClick={() => { setMode('list'); next() }}
              className={`rounded-xl border-2 p-6 text-left transition-all hover:border-primary ${
                mode === 'list' ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <div className="text-2xl mb-2">📋</div>
              <div className="font-semibold">清單模式</div>
              <div className="text-sm text-muted-foreground mt-1">
                跟著 Blind 75、NeetCode 150 等精選清單依序刷題
              </div>
            </button>
            <button
              onClick={() => { setMode('filter'); next() }}
              className={`rounded-xl border-2 p-6 text-left transition-all hover:border-primary ${
                mode === 'filter' ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <div className="text-2xl mb-2">🔍</div>
              <div className="font-semibold">篩選模式</div>
              <div className="text-sm text-muted-foreground mt-1">
                設定難度範圍，系統每天從題庫中隨機送題
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Step 2: List or filter config */}
      {step === 2 && mode === 'list' && (
        <div>
          <h1 className="text-2xl font-bold mb-2">選擇學習清單</h1>
          <p className="text-muted-foreground mb-6">選一份你想從頭開始的清單</p>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {lists.map((l) => (
              <button
                key={l.id}
                onClick={() => setListId(l.id)}
                className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-all hover:border-primary ${
                  listId === l.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <span className="font-medium">{l.name}</span>
                <span className="text-muted-foreground ml-2">({l.problem_count} 題)</span>
              </button>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={back}>上一步</Button>
            <Button onClick={next} disabled={!listId}>下一步</Button>
          </div>
        </div>
      )}

      {step === 2 && mode === 'filter' && (
        <div>
          <h1 className="text-2xl font-bold mb-2">設定難度範圍</h1>
          <p className="text-muted-foreground mb-6">依 Zerotrac Contest Rating 篩選</p>
          <div className="space-y-4">
            {[
              { label: '≤ 1300（入門）', min: 0, max: 1300 },
              { label: '1300 – 1500（初階）', min: 1300, max: 1500 },
              { label: '1500 – 1700（中階）', min: 1500, max: 1700 },
              { label: '1700+（進階）', min: 1700, max: 3000 },
            ].map((tier) => (
              <button
                key={tier.label}
                onClick={() => { setDiffMin(tier.min); setDiffMax(tier.max) }}
                className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-all hover:border-primary ${
                  diffMin === tier.min && diffMax === tier.max
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={back}>上一步</Button>
            <Button onClick={next}>下一步</Button>
          </div>
        </div>
      )}

      {/* Step 3: Timezone + push hour */}
      {step === 3 && (
        <div>
          <h1 className="text-2xl font-bold mb-2">設定通知時間</h1>
          <p className="text-muted-foreground mb-6">每天幾點要收到題目？</p>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1">時區</label>
              <div className="flex gap-2">
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
                >
                  自動
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">通知時間</label>
              <select
                value={pushHour}
                onChange={(e) => setPushHour(Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <Button variant="outline" onClick={back}>上一步</Button>
            <Button onClick={next}>下一步</Button>
          </div>
        </div>
      )}

      {/* Step 4: Channel connection (email first, others optional) */}
      {step === 4 && (
        <div>
          <h1 className="text-2xl font-bold mb-2">連結通知頻道</h1>
          <p className="text-muted-foreground mb-6">一鍵開啟 Email 通知，最快開始收題！</p>
          <div className="rounded-xl border p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">📧</span>
              <div className="flex-1">
                <p className="text-sm font-medium">Email 通知</p>
                <p className="text-xs text-muted-foreground mt-0.5">使用你的登入信箱，一鍵連結、無需驗證</p>
              </div>
              <EmailConnectButton />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            也可以之後在「設定 → 通知」連結 Telegram 或 LINE。
          </p>
          <p className="text-xs text-muted-foreground/70 mt-4 text-center">
            完成後帶你看你的咖啡園 →
          </p>
          <div className="flex gap-3 mt-8">
            <Button variant="outline" onClick={back}>上一步</Button>
            <Button onClick={finish} disabled={isPending}>
              {isPending ? '設定中...' : '完成設定'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
