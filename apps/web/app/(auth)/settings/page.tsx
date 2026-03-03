import { createClient } from '@/lib/supabase/server'
import { getUserSettings } from '@/lib/repositories/user.repository'
import { getChannelsForUser } from '@/lib/repositories/channel.repository'
import { redirect } from 'next/navigation'
import { PushSettingsForm } from './push-settings-form'
import { ChannelConnectButton } from './notifications/channel-connect-button'
import { connectTelegram } from '@/lib/actions/telegram'
import { connectLine } from '@/lib/actions/line'
import { disconnectChannel } from '@/lib/actions/notifications'
import { EmailConnectButton } from './notifications/email-connect-button'
import { Separator } from '@/components/ui/separator'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '通知設定 — CaffeCode' }

const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  line: 'LINE',
  email: 'Email',
}

export default async function PushNotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profile, channels] = await Promise.all([
    getUserSettings(supabase, user.id),
    getChannelsForUser(supabase, user.id),
  ])

  const connectedTypes = new Set(channels.map((ch) => ch.channel_type))

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-1">通知設定</h1>
        <p className="text-sm text-muted-foreground">管理每日通知時間與通知頻道</p>
      </div>

      <PushSettingsForm
        pushEnabled={profile?.push_enabled ?? false}
        pushHour={profile?.push_hour ?? 9}
        timezone={profile?.timezone ?? 'Asia/Taipei'}
      />

      <Separator />

      {/* Notification channels */}
      <section>
        <h2 className="text-base font-semibold mb-4">通知頻道</h2>
        {channels.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground mb-4">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm">尚未連結任何通知頻道</p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border mb-4">
            {channels.map((ch) => (
              <li key={ch.id} className="flex items-center justify-between px-4 py-4">
                <div>
                  <p className="text-sm font-medium">
                    {CHANNEL_LABELS[ch.channel_type] ?? ch.channel_type}
                    {ch.display_label && (
                      <span className="text-muted-foreground ml-2">@{ch.display_label}</span>
                    )}
                  </p>
                  <p className="text-xs mt-0.5">
                    {ch.is_verified ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 text-[11px] font-medium">
                        ✓ 已驗證
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 text-[11px] font-medium">
                        ⚠ 待驗證
                      </span>
                    )}
                    <span className="text-muted-foreground ml-2">
                      · 連結於 {new Date(ch.connected_at).toLocaleDateString('zh-TW')}
                    </span>
                  </p>
                </div>
                <form
                  action={async () => {
                    'use server'
                    await disconnectChannel(ch.id)
                  }}
                >
                  <button type="submit" className="text-xs text-destructive hover:underline">
                    取消連結
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          {!connectedTypes.has('email') && (
            <div className="rounded-lg border p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium">新增 Email</p>
                <p className="text-xs text-muted-foreground mt-0.5">以登入 Email 接收每日題目通知（HTML 郵件）</p>
              </div>
              <EmailConnectButton />
            </div>
          )}
          {!connectedTypes.has('telegram') && (
            <div className="rounded-lg border p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium">新增 Telegram</p>
                <p className="text-xs text-muted-foreground mt-0.5">透過 Telegram Bot 接收每日題目通知</p>
              </div>
              <ChannelConnectButton
                channelName="Telegram"
                channelColor="bg-[#2AABEE]"
                onConnect={connectTelegram}
                tokenInstruction="開啟後點選「開始」即可完成連結，或手動發送以下指令："
              />
            </div>
          )}
          {!connectedTypes.has('line') && profile?.line_push_allowed && (
            <div className="rounded-lg border p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium">新增 LINE</p>
                <p className="text-xs text-muted-foreground mt-0.5">透過 LINE 官方帳號接收每日題目通知</p>
              </div>
              <ChannelConnectButton
                channelName="LINE"
                channelColor="bg-[#06C755]"
                onConnect={connectLine}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
