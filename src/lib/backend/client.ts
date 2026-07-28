/**
 * client.ts — Shared helpers for the serverless backend routes.
 *
 * Auth model mirrors the retired FastAPI backend: validate the caller's Supabase
 * session (via Bearer token OR cookies), then run DB operations with a
 * service-role client (bypasses RLS, exactly like the Python `supabase` client).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Service-role client — full DB access, no user session. */
export function admin(): SupabaseClient {
  return createClient(URL, SERVICE, { auth: { persistSession: false } })
}

/** Resolve the authenticated user id from a Bearer token or session cookies. */
export async function getUserId(req: Request): Promise<string | null> {
  // 1. Authorization: Bearer <access_token>
  const authHeader = req.headers.get('authorization')
  const token = authHeader && /^bearer /i.test(authHeader) ? authHeader.slice(7).trim() : null
  if (token) {
    try {
      const anon = createClient(URL, ANON, { auth: { persistSession: false } })
      const { data, error } = await anon.auth.getUser(token)
      if (!error && data.user) return data.user.id
    } catch {
      /* fall through to cookies */
    }
  }

  // 2. Session cookies (same-origin fetch sends these automatically)
  try {
    const cookieStore = cookies()
    const ssr = createServerClient(URL, ANON, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    })
    const { data } = await ssr.auth.getUser()
    if (data.user) return data.user.id
  } catch {
    /* unauthenticated */
  }

  return null
}

export const ok = (body: unknown) => NextResponse.json(body)
export const unauthorized = () => NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
export const badRequest = (detail: string) => NextResponse.json({ detail }, { status: 400 })
export const notFound = (detail = 'Not found') => NextResponse.json({ detail }, { status: 404 })
export const serverError = (detail = 'Something went wrong') =>
  NextResponse.json({ detail }, { status: 500 })

/** Best-effort XP award — never throws (matches the Python behaviour). */
export async function awardXp(db: SupabaseClient, userId: string, amount: number) {
  try {
    await db.rpc('increment_xp', { p_user_id: userId, p_amount: Math.round(amount) })
  } catch {
    /* non-fatal */
  }
}

/** Best-effort activity-feed log — never throws. */
export async function logActivity(
  db: SupabaseClient,
  userId: string,
  actionType: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await db.from('activity_feed').insert({
      actor_id: userId,
      action_type: actionType,
      metadata_json: metadata,
    })
  } catch {
    /* non-fatal */
  }
}
