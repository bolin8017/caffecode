import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('problems')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (error) {
      return Response.json(
        { status: 'error', message: 'Database unreachable' },
        { status: 503 }
      )
    }

    return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[health] Health check failed:', err)
    return Response.json(
      { status: 'error', message: 'Health check failed' },
      { status: 503 }
    )
  }
}
