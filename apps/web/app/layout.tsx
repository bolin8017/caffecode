import type { Metadata, Viewport } from 'next'
import { Noto_Sans_TC, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { Nav } from '@/components/nav'
import { PostHogProvider } from '@/components/posthog-provider'
import { headers } from 'next/headers'
import { JsonLd } from '@/components/seo/json-ld'
import { organizationSchema, webSiteSchema } from '@/lib/seo/schemas'

const notoSansTC = Noto_Sans_TC({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export function generateViewport(): Viewport {
  return { viewportFit: 'cover' }
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://caffecode.net'),
  title: {
    default: 'CaffeCode — 每天一杯咖啡配一道題',
    template: '%s — CaffeCode',
  },
  description: '每天一杯咖啡配一道題，把刷題變成習慣，輕鬆備好技術面試。瀏覽 810+ 道精選資料結構與演算法題目，含 AI 解題說明。',
  openGraph: {
    type: 'website',
    siteName: 'CaffeCode',
    locale: 'zh_TW',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'CaffeCode' }],
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Read user profile from proxy header (set in updateSession)
  const headerStore = await headers()
  const profileHeader = headerStore.get('x-user-profile')
  const userProfile = profileHeader ? JSON.parse(decodeURIComponent(profileHeader)) as {
    display_name: string | null
    avatar_url: string | null
    is_admin: boolean
  } : null

  return (
    <html lang="zh-Hant">
      <body className={`${notoSansTC.variable} ${geistMono.variable} antialiased font-sans`}>
        <JsonLd data={organizationSchema()} />
        <JsonLd data={webSiteSchema()} />
        <PostHogProvider>
          <Nav userProfile={userProfile} />
          {children}
        </PostHogProvider>
        <Toaster position="bottom-center" duration={3000} />
      </body>
    </html>
  )
}
