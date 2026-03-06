export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initSentry } = await import('@/lib/sentry')
    initSentry()

    // Fail fast if required env vars are missing
    const { serverEnvSchema } = await import('@/lib/env')
    const result = serverEnvSchema.safeParse(process.env)
    if (!result.success) {
      console.error('Missing or invalid environment variables:', result.error.flatten().fieldErrors)
      // Don't crash — some vars may only be needed for specific routes
    }
  }
}
