import { createServiceClient } from '@/lib/supabase/server'
import type { MetadataRoute } from 'next'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceClient()

  const [problemsRes, listsRes] = await Promise.all([
    supabase.from('problems').select('slug').not('slug', 'is', null).limit(5000),
    supabase.from('curated_lists').select('slug').limit(1000),
  ])

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://caffecode.net'
  const now = new Date()

  const problems = problemsRes.error ? [] : (problemsRes.data ?? [])
  const lists = listsRes.error ? [] : (listsRes.data ?? [])

  return [
    { url: baseUrl, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/problems`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/lists`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ...problems.map(p => ({
      url: `${baseUrl}/problems/${p.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...lists.map(l => ({
      url: `${baseUrl}/lists/${l.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ]
}
