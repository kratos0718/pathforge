import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Razorpay from 'razorpay'

const PLAN_AMOUNT = 9900 // ₹99 in paise

export async function POST() {
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

  // ── Check not already premium ─────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('users')
    .select('tier')
    .eq('id', user.id)
    .single()

  if (profile?.tier === 'premium') {
    return NextResponse.json({ error: 'Already premium' }, { status: 400 })
  }

  // ── Razorpay keys check ───────────────────────────────────────────────────
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Payment not configured' }, { status: 503 })
  }

  // ── Create Razorpay order ─────────────────────────────────────────────────
  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

    const order = await razorpay.orders.create({
      amount: PLAN_AMOUNT,
      currency: 'INR',
      receipt: `pf_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: user.id, plan: 'premium_monthly' },
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: keyId,
    })
  } catch (err) {
    console.error('Razorpay order error:', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
