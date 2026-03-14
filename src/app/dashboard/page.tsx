'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface UserProfile {
  name: string
  target_role: string
  semester: number
  college: string
  xp: number
  streak: number
  tier: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/auth'; return }

      const { data } = await supabase
        .from('users')
        .select('name, target_role, semester, college, xp, streak, tier')
        .eq('id', session.user.id)
        .single()

      setUser(data)
      setLoading(false)
    }
    loadUser()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading your dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-white">PathForge</span>
          {user?.tier === 'premium' && (
            <Badge className="bg-yellow-500 text-yellow-900 text-xs">PRO</Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">🔥 {user?.streak ?? 0} day streak</span>
          <span className="text-purple-400 text-sm font-medium">⚡ {user?.xp ?? 0} XP</span>
          <Button onClick={handleSignOut} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700">
            Sign out
          </Button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, {user?.name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-slate-400 mt-1">
            {user?.college} · Semester {user?.semester} · Target: {user?.target_role ?? 'Not set'}
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Placement Readiness" value="—" sub="Complete your profile" color="purple" />
          <StatCard label="DSA Problems" value="0" sub="Problems solved" color="blue" />
          <StatCard label="Active Courses" value="0" sub="In progress" color="green" />
          <StatCard label="Active Challenges" value="0" sub="With friends" color="orange" />
        </div>

        {/* Modules grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ModuleCard
            title="🧭 Role Compass"
            description="AI chat that recommends your best-fit career path"
            status="ready"
            href="/compass"
          />
          <ModuleCard
            title="🗺️ My Roadmap"
            description="Your personalised 16-week placement plan"
            status="ready"
            href="/roadmap"
          />
          <ModuleCard
            title="📊 CGPA Tracker"
            description="Calculate CGPA, simulate targets, track company cutoffs"
            status="Phase 3"
            href="/cgpa"
          />
          <ModuleCard
            title="💻 DSA Tracker"
            description="Striver A2Z, Love Babbar 450, NeetCode 150"
            status="Phase 3"
            href="/dsa"
          />
          <ModuleCard
            title="📚 Courses"
            description="Track progress across Udemy, YouTube, NPTEL, Coursera"
            status="Phase 4"
            href="/courses"
          />
          <ModuleCard
            title="👥 Friends & Challenges"
            description="Compete with batchmates, live leaderboards"
            status="Phase 5"
            href="/friends"
          />
        </div>

        {/* Banner */}
        <div className="bg-gradient-to-r from-purple-900 to-blue-900 rounded-xl p-6 border border-purple-700">
          <h2 className="text-lg font-semibold text-white mb-1">Phase 1 complete! ✅</h2>
          <p className="text-slate-300 text-sm">
            Auth, profile, and onboarding are live. Phase 2 builds the Role Compass AI and your 16-week adaptive roadmap.
          </p>
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    purple: 'text-purple-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    orange: 'text-orange-400',
  }
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-4">
        <p className="text-slate-400 text-xs">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${colors[color]}`}>{value}</p>
        <p className="text-slate-500 text-xs mt-1">{sub}</p>
      </CardContent>
    </Card>
  )
}

function ModuleCard({ title, description, status, href }: { title: string; description: string; status: string; href: string }) {
  const isReady = status === 'ready'
  const Wrapper = isReady ? 'a' : 'div'
  return (
    <Wrapper href={isReady ? href : undefined} className={`block border-slate-700 rounded-xl transition-all ${isReady ? 'bg-slate-800 hover:border-purple-500 cursor-pointer' : 'bg-slate-800/50'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-white">{title}</CardTitle>
          <Badge
            variant="outline"
            className={isReady ? 'border-green-500 text-green-400 text-xs' : 'border-slate-600 text-slate-500 text-xs'}
          >
            {isReady ? 'Live' : `Coming — ${status}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-slate-400 text-sm">{description}</p>
      </CardContent>
    </Wrapper>
  )
}
