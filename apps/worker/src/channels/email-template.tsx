// apps/worker/src/channels/email-template.tsx
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Preview,
} from '@react-email/components'

interface Props {
  title: string
  difficulty: string
  leetcodeId: number
  problemUrl: string
  appUrl?: string
}

function difficultyColor(d: string): string {
  if (d === 'Easy') return '#22c55e'
  if (d === 'Hard') return '#ef4444'
  return '#f97316'
}

export function DailyProblemEmail({ title, difficulty, leetcodeId, problemUrl, appUrl = 'https://caffecode.net' }: Props) {
  return (
    <Html lang="zh-TW">
      <Head />
      <Preview>今日 CaffeCode 題目：{title}</Preview>
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: 'ui-sans-serif, system-ui, sans-serif', margin: 0 }}>

        {/* Brand bar */}
        <Section style={{ backgroundColor: '#0f172a', padding: '16px 0', textAlign: 'center' }}>
          <Text style={{ color: '#f8fafc', fontSize: '18px', fontWeight: '700', margin: 0, letterSpacing: '0.02em' }}>
            ☕ CaffeCode
          </Text>
        </Section>

        {/* Main content card */}
        <Container style={{ maxWidth: '560px', margin: '32px auto', backgroundColor: '#ffffff', borderRadius: '12px', padding: '36px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

          {/* Difficulty badge */}
          <Section style={{ marginBottom: '12px' }}>
            <Text style={{
              display: 'inline',
              backgroundColor: difficultyColor(difficulty),
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '600',
              padding: '3px 12px',
              borderRadius: '999px',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {difficulty}
            </Text>
          </Section>

          {/* LeetCode number */}
          <Text style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 6px' }}>
            #{leetcodeId}
          </Text>

          {/* Title */}
          <Text style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 32px', lineHeight: '1.3' }}>
            {title}
          </Text>

          {/* CTA Button */}
          <Button
            href={problemUrl}
            style={{
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              fontSize: '14px',
              fontWeight: '600',
              padding: '14px 28px',
              borderRadius: '8px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            查看解題 →
          </Button>
        </Container>

        {/* Footer */}
        <Section style={{ textAlign: 'center', padding: '8px 0 36px' }}>
          <Text style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 4px' }}>
            CaffeCode · 每天一杯咖啡配一道題
          </Text>
          <Text style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
            如需取消 Email 通知，請至{' '}
            <a href={`${appUrl}/settings`} style={{ color: '#64748b' }}>設定頁面</a>
            {' '}移除 Email 頻道。
          </Text>
        </Section>

      </Body>
    </Html>
  )
}
