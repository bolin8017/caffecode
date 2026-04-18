'use client'

import { initPostHog } from '@/lib/posthog'

// Called once at module load (not per render) since PostHog's init is
// globally idempotent and only needs to happen once per browser session.
initPostHog()

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
