import * as Sentry from '@sentry/nextjs'

export function initSentry() {
  if (!process.env.SENTRY_DSN) return

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  })
}
