import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/dashboard', '/settings', '/onboarding', '/garden', '/api'] }],
    sitemap: 'https://caffecode.net/sitemap.xml',
  }
}
