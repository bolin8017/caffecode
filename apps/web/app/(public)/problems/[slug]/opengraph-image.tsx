import { ImageResponse } from 'next/og'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const alt = 'CaffeCode Problem'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#10b981',
  Medium: '#f59e0b',
  Hard: '#ef4444',
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('problems')
    .select('title, difficulty, topics')
    .eq('slug', slug)
    .single()

  // Fallback for missing problem
  if (!data) {
    return new ImageResponse(
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%',
        backgroundColor: '#1a1a1a', color: '#fff', fontSize: 48,
      }}>
        CaffeCode
      </div>,
      { ...size }
    )
  }

  const topics = (data.topics as string[]).slice(0, 4)
  const diffColor = DIFFICULTY_COLORS[data.difficulty] ?? '#a1a1aa'

  return new ImageResponse(
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100%',
      backgroundColor: '#1a1a1a', padding: '60px 80px',
    }}>
      {/* Top: Logo text */}
      <div style={{ display: 'flex', color: '#a1a1aa', fontSize: 24 }}>
        CaffeCode
      </div>

      {/* Center: Title */}
      <div style={{
        display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex', fontSize: 52, fontWeight: 700,
          color: '#ffffff', lineHeight: 1.3, maxWidth: '900px',
        }}>
          {data.title}
        </div>

        {/* Difficulty + Topics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
          <div style={{
            display: 'flex', padding: '6px 16px', borderRadius: '9999px',
            backgroundColor: diffColor, color: '#fff', fontSize: 20, fontWeight: 700,
          }}>
            {data.difficulty}
          </div>
          {topics.map((t) => (
            <div key={t} style={{
              display: 'flex', padding: '6px 16px', borderRadius: '9999px',
              backgroundColor: '#27272a', color: '#d4d4d8', fontSize: 18,
            }}>
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: URL */}
      <div style={{ display: 'flex', color: '#71717a', fontSize: 20 }}>
        caffecode.net
      </div>
    </div>,
    { ...size },
  )
}
