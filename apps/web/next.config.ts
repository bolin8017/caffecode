import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from "next";
import path from "path";

const workerSrc = path.resolve(__dirname, "../../apps/worker/src");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), payment=()' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // unsafe-inline required by Next.js inline scripts; migrate to nonce-based CSP when supported
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
              "connect-src 'self' https://mwgqiulgtawjrkvchtea.supabase.co wss://mwgqiulgtawjrkvchtea.supabase.co https://*.ingest.sentry.io https://*.posthog.com",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ]
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack(config: any) {
    // @worker alias mirrors tsconfig.json paths.
    // Also map every worker .js import to its .ts/.tsx source so webpack can
    // bundle worker modules that use NodeNext-style .js relative imports.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@worker': workerSrc,
      // channels
      [workerSrc + '/channels/email-template.js']: workerSrc + '/channels/email-template.tsx',
      [workerSrc + '/channels/email.js']: workerSrc + '/channels/email.ts',
      [workerSrc + '/channels/interface.js']: workerSrc + '/channels/interface.ts',
      [workerSrc + '/channels/line.js']: workerSrc + '/channels/line.ts',
      [workerSrc + '/channels/registry.js']: workerSrc + '/channels/registry.ts',
      [workerSrc + '/channels/telegram.js']: workerSrc + '/channels/telegram.ts',
      // lib — config replaced with a stub that skips Zod parse at build time
      [workerSrc + '/lib/config.schema.js']: workerSrc + '/lib/config.schema.ts',
      [workerSrc + '/lib/config.js']: path.resolve(__dirname, './lib/worker-stubs/config.ts'),
      [workerSrc + '/lib/config.ts']: path.resolve(__dirname, './lib/worker-stubs/config.ts'),
      [workerSrc + '/lib/logger.js']: workerSrc + '/lib/logger.ts',
      [workerSrc + '/lib/supabase.js']: workerSrc + '/lib/supabase.ts',
      // repositories
      [workerSrc + '/repositories/push.repository.js']: workerSrc + '/repositories/push.repository.ts',
      // workers
      [workerSrc + '/workers/push.logic.js']: workerSrc + '/workers/push.logic.ts',
    }
    return config
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
})
