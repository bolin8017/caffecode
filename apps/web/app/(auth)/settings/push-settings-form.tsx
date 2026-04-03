'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { updatePushSettings, updateTimezone } from '@/lib/actions/settings'

interface Props {
  pushEnabled: boolean
  pushHour: number
  timezone: string
}

export function PushSettingsForm({ pushEnabled: initialEnabled, pushHour: initialHour, timezone: initialTz }: Props) {
  const [isPending, startTransition] = useTransition()
  const [pushEnabled, setPushEnabled] = useState(initialEnabled)
  const [pushHour, setPushHour] = useState(initialHour)
  const [timezone, setTimezone] = useState(initialTz)
  const [saved, setSaved] = useState('')

  const save = (action: () => Promise<void>, label: string) => {
    startTransition(async () => {
      try {
        await action()
        setSaved(label)
        setTimeout(() => setSaved(''), 2500)
      } catch {
        toast.error('儲存失敗，請再試一次')
      }
    })
  }

  return (
    <div className="space-y-8">
      {saved && (
        <div role="status" className="rounded-md bg-green-50 dark:bg-green-950 px-4 py-2 text-sm text-green-700 dark:text-green-300">
          ✓ {saved} 已儲存
        </div>
      )}

      <section>
        <h2 className="text-base font-semibold mb-4">通知設定</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="push-toggle">每日通知</Label>
            <Switch
              id="push-toggle"
              checked={pushEnabled}
              onCheckedChange={(val) => {
                setPushEnabled(val)
                save(() => updatePushSettings(val, pushHour), '通知設定')
              }}
            />
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="push-hour" className="shrink-0">通知時間</Label>
            <select
              id="push-hour"
              value={pushHour}
              onChange={(e) => setPushHour(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => save(() => updatePushSettings(pushEnabled, pushHour), '通知時間')}
            >
              儲存
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-4">時區</h2>
        <div className="flex items-center gap-3">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-9 flex-1 max-w-xs rounded-md border border-input bg-background px-3 text-sm"
          >
            {(() => {
              const zones = Intl.supportedValuesOf('timeZone')
              const grouped: Record<string, string[]> = {}
              for (const tz of zones) {
                const slash = tz.indexOf('/')
                const region = slash === -1 ? 'Other' : tz.slice(0, slash)
                ;(grouped[region] ??= []).push(tz)
              }
              return Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([region, tzs]) => (
                  <optgroup key={region} label={region}>
                    {tzs.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </optgroup>
                ))
            })()}
          </select>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
          >
            自動偵測
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => save(() => updateTimezone(timezone), '時區')}
          >
            儲存
          </Button>
        </div>
      </section>
    </div>
  )
}
