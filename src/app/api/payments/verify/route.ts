import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = await req.json()

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
  }

  // ── Verify HMAC signature ─────────────────────────────────────────────────
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keySecret) {
    return NextResponse.json({ error: 'Payment not configured' }, { status: 503 })
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body)
    .digest('hex')

  if (expectedSignature !== razorpay_signature) {
    console.error('Signature mismatch — possible fraud attempt', { user_id: user.id })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── Upgrade user to premium (service role — bypasses RLS) ─────────────────
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error: updateError } = await adminSupabase
    .from('users')
    .update({
      tier: 'premium',
      premium_since: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('Failed to upgrade user tier:', updateError)
    return NextResponse.json({ error: 'Upgrade failed — contact support' }, { status: 500 })
  }

  // ── Log the payment ───────────────────────────────────────────────────────
  await adminSupabase.from('payments').insert({
    user_id: user.id,
    razorpay_payment_id,
    razorpay_order_id,
    amount: 9900,
    currency: 'INR',
    status: 'captured',
    plan: 'premium_monthly',
  }).then(() => {/* best-effort log, don't fail if payments table doesn't exist */})

  // ── XP reward ─────────────────────────────────────────────────────────────
  await adminSupabase.rpc('increment_xp', { user_id: user.id, amount: 500 })
    .then(() => {/* best-effort */})

  return NextResponse.json({ success: true, message: 'Welcome to PathForge Premium! 🎉' })
}
