import { NextResponse } from 'next/server'

/**
 * GET /api/health
 * Lightweight liveness probe for the Next.js layer.
 * Also pings the FastAPI backend so Railway doesn't sleep.
 * Called by UptimeRobot / BetterStack every 5 minutes to keep both services warm.
 */
export async function GET() {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

  let backendStatus: 'ok' | 'unreachable' = 'unreachable'
  try {
    const res = await fetch(`${BACKEND}/health`, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
    if (res.ok) backendStatus = 'ok'
  } catch {
    // backend down — log but don't fail the health check
    console.warn('[health] FastAPI backend unreachable')
  }

  return NextResponse.json({
    status: 'ok',
    frontend: 'ok',
    backend: backendStatus,
    timestamp: new Date().toISOString(),
  })
}
