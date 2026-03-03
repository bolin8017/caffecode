import { describe, it, expect } from 'vitest'

describe('GET /api/health', () => {
  it('returns status ok with expected fields', async () => {
    const { GET } = await import('../app/api/health/route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body).toHaveProperty('timestamp')
  })
})
