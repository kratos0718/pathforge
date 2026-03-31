'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Compass, Map, Calculator, Code2, BookOpen, Users,
  Flame, Zap, TrendingUp, LogOut, ChevronRight, Bell,
  Trophy, Crown, CheckCircle2, Clock, Target, Star, GraduationCap, ShieldCheck,
} from 'lucide-react'
import { motion } from 'framer-motion'

interface UserProfile {
  name: string
  target_role: string
  semester: number
  college: string
  xp: number
  streak: number
  tier: string
}

interface ScoreData {
  score: number
  dsa_score: number
  cgpa_score: number
  course_score: number
  project_score: number
  aptitude_score: number
}

interface RoadmapTask {
  id: string
  title: string
  type: string
  week_number: number
  status: string
}

interface Notification {
  id: string
  type: string
  message: string
  read: boolean
  created_at: string
}

interface ActivityItem {
  id: string
  actor_id: string
  action_type: string
  metadata: Record<string, unknown>
  created_at: string
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [dsaSolved, setDsaSolved] = useState<number>(0)
  const [cgpa, setCgpa] = useState<number | null>(null)
  const [roadmapProgress, setRoadmapProgress] = useState<{ done: number; total: number } | null>(null)
  const [score, setScore] = useState<ScoreData | null>(null)
  const [todayTasks, setTodayTasks] = useState<RoadmapTask[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [activeChallenges, setActiveChallenges] = useState<number>(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/auth'; return }
      setToken(session.access_token)
      setUserId(session.user.id)
      setUserEmail(session.user.email ?? '')

      const { data } = await supabase
        .from('users')
        .select('name, target_role, semester, college, xp, streak, tier')
        .eq('id', session.user.id)
        .single()
      setUser(data)
      setLoading(false)

      const tok = session.access_token
      const uid = session.user.id

      // Fetch all data in parallel
      await Promise.allSettled([
        // DSA stats
        fetch(`${BACKEND}/dsa/stats`, { headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.json()).then(d => setDsaSolved(d.total_solved || 0)),

        // CGPA
        fetch(`${BACKEND}/cgpa/calculate`, { headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.json()).then(d => setCgpa(d.cgpa ?? null)),

        // Roadmap progress
        fetch(`${BACKEND}/roadmap/my-plan`, { headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.json()).then(d => {
            if (d?.tasks) {
              const done = d.tasks.filter((t: { status: string }) => t.status === 'completed').length
              setRoadmapProgress({ done, total: d.tasks.length })
              // Today's tasks = first 3 pending/prioritized
              const upcoming = d.tasks
                .filter((t: RoadmapTask) => t.status === 'pending' || t.status === 'prioritized')
                .slice(0, 3)
              setTodayTasks(upcoming)
            }
          }),

        // Readiness score
        fetch(`${BACKEND}/score/calculate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tok}` },
        }).then(r => r.json()).then(d => {
          if (d.score !== undefined) setScore(d)
        }),

        // Active challenges count
        fetch(`${BACKEND}/challenges/active`, { headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.json()).then(d => {
            if (Array.isArray(d)) setActiveChallenges(d.length)
          }),

        // Notifications from Supabase directly
        supabase.from('notifications')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(10)
          .then(({ data: notifs }) => {
            if (notifs) setNotifications(notifs)
          }),

        // Activity feed (friends + self)
        fetch(`${BACKEND}/friends/feed`, { headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.json()).then(d => {
            if (Array.isArray(d)) setActivity(d.slice(0, 5))
          }),
      ])
    }
    loadDashboard()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  async function markNotifsRead() {
    if (!userId) return
    await supabase.from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    )
  }

  const xpToNext = 500 - ((user?.xp ?? 0) % 500)
  const xpProgress = (((user?.xp ?? 0) % 500) / 500) * 100
  const level = Math.floor((user?.xp ?? 0) / 500) + 1
  const unreadCount = notifications.filter(n => !n.read).length

  // Score ring
  const scoreVal = score?.score ?? 0
  const CIRCUMFERENCE = 326.7
  const scoreDash = (scoreVal / 100) * CIRCUMFERENCE
  const scoreColor = scoreVal >= 70 ? '#10b981' : scoreVal >= 50 ? '#f59e0b' : '#ef4444'
  const scoreLabel = scoreVal >= 80 ? 'Placement-ready 🚀' : scoreVal >= 60 ? 'Good progress 📈' : scoreVal >= 40 ? 'Stay consistent 💪' : 'Time to grind 🔥'

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-heading text-lg font-bold text-white tracking-tight">PathForge</span>
          {user?.tier === 'premium' && (
            <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Crown size={10} /> PRO
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <a href="/subjects" className="hidden md:flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors">
            <GraduationCap size={14} /> Subjects
          </a>
          {process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim()).includes(userEmail) && (
            <a href="/admin" className="hidden md:flex items-center gap-1.5 text-rose-400/60 hover:text-rose-400 text-xs transition-colors">
              <ShieldCheck size={14} /> Admin
            </a>
          )}
          <div className="flex items-center gap-1.5 text-orange-400 text-sm font-body">
            <Flame size={14} className="fill-orange-400" />
            <span className="font-semibold">{user?.streak ?? 0}</span>
            <span className="text-white/30 hidden sm:inline">day streak</span>
          </div>
          <div className="flex items-center gap-1.5 text-yellow-400 text-sm font-body">
            <Zap size={14} className="fill-yellow-400" />
            <span className="font-semibold">{user?.xp ?? 0}</span>
            <span className="text-white/30 hidden sm:inline">XP</span>
          </div>
          {/* Notifications bell */}
          <div className="relative">
            <button
              onClick={() => { setShowNotifs(v => !v); if (!showNotifs) markNotifsRead() }}
              className="relative p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Bell size={16} className="text-white/60" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 rounded-full text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifs && (
              <div className="absolute right-0 top-10 w-80 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <span className="text-sm font-heading font-semibold">Notifications</span>
                  <button onClick={() => setShowNotifs(false)} className="text-white/40 hover:text-white text-xs">✕</button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-white/30 text-xs text-center py-6">No notifications yet</p>
                  ) : notifications.map(n => (
                    <div key={n.id} className={`px-4 py-3 border-b border-white/5 ${!n.read ? 'bg-white/3' : ''}`}>
                      <p className="text-sm text-white/80 font-body leading-snug">{n.message}</p>
                      <p className="text-xs text-white/30 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="text-white/40 hover:text-white gap-1.5 text-xs"
          >
            <LogOut size={12} /> Sign out
          </Button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Hero: Welcome + Score ring */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Welcome + XP */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <h1 className="font-heading text-3xl font-extrabold">
                <span className="text-white">Welcome back, </span>
                <span className="animate-gradient-title">{user?.name?.split(' ')[0] ?? 'there'}</span>
                <span className="text-white"> 👋</span>
              </h1>
              <p className="text-white/40 mt-1 font-body text-sm">
                {user?.college} · Semester {user?.semester} · {user?.target_role ?? 'Role not set'}
              </p>
            </div>

            {/* XP progress */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-heading font-semibold text-yellow-400">{user?.xp ?? 0} XP</span>
                  <span className="text-xs text-white/30 font-body">Level {level}</span>
                </div>
                <span className="text-xs text-white/30 font-body">{xpToNext} XP to Level {level + 1}</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transition-all duration-1000"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>

            {/* Today's Tasks */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target size={14} className="text-violet-400" />
                <span className="text-sm font-heading font-semibold text-white/70">Up Next</span>
                {activeChallenges > 0 && (
                  <span className="ml-auto text-xs text-rose-400 font-body flex items-center gap-1">
                    <Flame size={10} className="fill-rose-400" /> {activeChallenges} active challenge{activeChallenges > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {todayTasks.length === 0 ? (
                <p className="text-white/30 text-xs font-body">
                  No roadmap tasks yet —{' '}
                  <a href="/roadmap" className="text-violet-400 hover:underline">generate your roadmap</a>
                </p>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
                        task.status === 'prioritized' ? 'border-yellow-400 bg-yellow-400/20' : 'border-white/20'
                      }`}>
                        {task.status === 'prioritized' && <Star size={8} className="text-yellow-400 fill-yellow-400" />}
                      </div>
                      <div>
                        <p className="text-xs text-white/70 font-body leading-snug">{task.title}</p>
                        <p className="text-[10px] text-white/30 font-body">Week {task.week_number} · {task.type}</p>
                      </div>
                    </div>
                  ))}
                  <a href="/roadmap" className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 mt-2 transition-colors">
                    View full roadmap <ChevronRight size={10} />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Readiness Score Ring */}
          <div className="flex flex-col items-center bg-white/3 border border-white/8 rounded-2xl p-5">
            <p className="text-xs text-white/40 font-body uppercase tracking-widest mb-3">Readiness Score</p>
            <div className="relative">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${scoreDash} ${CIRCUMFERENCE}`}
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dasharray 1s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading text-2xl font-bold text-white">{Math.round(scoreVal)}</span>
                <span className="text-[10px] text-white/30 font-body">/100</span>
              </div>
            </div>
            <p className="text-xs text-white/50 font-body text-center mt-2">{scoreLabel}</p>
            <a href="/score" className="mt-3 text-[11px] text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors">
              View breakdown <ChevronRight size={10} />
            </a>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Roadmap Progress"
            value={roadmapProgress ? `${roadmapProgress.done}/${roadmapProgress.total}` : '—'}
            sub={roadmapProgress ? `${Math.round((roadmapProgress.done / Math.max(roadmapProgress.total, 1)) * 100)}% complete` : 'Generate roadmap first'}
            gradient="from-violet-500 to-purple-600"
            icon={<Map size={14} />}
          />
          <StatCard
            label="DSA Solved"
            value={String(dsaSolved)}
            sub="problems solved"
            gradient="from-blue-500 to-cyan-500"
            icon={<Code2 size={14} />}
          />
          <StatCard
            label="CGPA"
            value={cgpa !== null ? cgpa.toFixed(2) : '—'}
            sub={cgpa !== null ? (cgpa >= 8 ? 'Excellent' : cgpa >= 7 ? 'Good' : 'Keep pushing') : 'Add subjects first'}
            gradient="from-emerald-500 to-teal-500"
            icon={<TrendingUp size={14} />}
          />
          <StatCard
            label="Total XP"
            value={String(user?.xp ?? 0)}
            sub={`Level ${level}`}
            gradient="from-yellow-400 to-orange-500"
            icon={<Zap size={14} />}
          />
        </div>

        {/* Two column: Modules + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Modules grid */}
          <div className="lg:col-span-2">
            <h2 className="font-heading text-sm text-white/60 uppercase tracking-widest mb-4 section-title-underline inline-block">Modules</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ModuleCard icon={<Compass size={20} />} title="Role Compass" description="AI chat that finds your best-fit career path" status="live" href="/compass" color="blue" />
              <ModuleCard icon={<Map size={20} />} title="My Roadmap" description="Your personalised 16-week adaptive placement plan" status="live" href="/roadmap" color="purple" />
              <ModuleCard icon={<Calculator size={20} />} title="CGPA Tracker" description="Calculate CGPA, simulate targets, check cutoffs" status="live" href="/cgpa" color="emerald" />
              <ModuleCard icon={<Code2 size={20} />} title="DSA Tracker" description="Striver A2Z — 455 problems, topic progress, XP" status="live" href="/dsa" color="cyan" />
              <ModuleCard icon={<BookOpen size={20} />} title="Course Tracker" description="Track courses with velocity metrics" status="live" href="/courses" color="orange" />
              <ModuleCard icon={<Users size={20} />} title="Friends" description="Find batchmates, activity feed, progress" status="live" href="/friends" color="pink" />
              <ModuleCard icon={<Flame size={20} />} title="Challenges" description="Create challenges, live leaderboards" status="live" href="/challenges" color="rose" />
              <ModuleCard icon={<Trophy size={20} />} title="Readiness Score" description="Your placement readiness with full breakdown" status="live" href="/score" color="yellow" />
              <ModuleCard icon={<GraduationCap size={20} />} title="CSE Subjects" description="OS, DBMS, CN, OOP, Sys Design — full learning paths" status="live" href="/subjects" color="indigo" />
            </div>
          </div>

          {/* Right column: Activity feed */}
          <div>
            <h2 className="font-heading text-sm text-white/60 uppercase tracking-widest mb-4 section-title-underline inline-block">Activity Feed</h2>
            <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
              {activity.length === 0 ? (
                <div className="p-5 text-center">
                  <p className="text-white/30 text-xs font-body">No activity yet.</p>
                  <a href="/friends" className="text-pink-400 text-xs hover:underline mt-1 inline-block">Find friends →</a>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {activity.map(item => (
                    <div key={item.id} className="px-4 py-3">
                      <p className="text-xs text-white/70 font-body leading-snug">{formatActivity(item)}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{timeAgo(item.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-white/5 px-4 py-2.5">
                <a href="/friends" className="text-[11px] text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors">
                  View full feed <ChevronRight size={10} />
                </a>
              </div>
            </div>

            {/* Upgrade CTA if free */}
            {user?.tier !== 'premium' && (
              <div className="mt-4 bg-gradient-to-br from-yellow-900/30 to-orange-900/20 border border-yellow-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Crown size={14} className="text-yellow-400" />
                  <span className="text-sm font-heading font-semibold text-yellow-400">Go Premium</span>
                </div>
                <p className="text-xs text-white/50 font-body mb-3">Unlock AI weekly check-ins, unlimited DSA, adaptive replanning & more.</p>
                <a href="/upgrade">
                  <Button className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-heading font-bold text-xs h-8 rounded-xl hover:opacity-90">
                    Upgrade for ₹99/month
                  </Button>
                </a>
              </div>
            )}

            {/* Sunday check-in (always show) */}
            <div className="mt-4 bg-white/3 border border-white/8 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} className="text-violet-400" />
                <span className="text-sm font-heading font-semibold text-white/70">Weekly Check-in</span>
              </div>
              <p className="text-xs text-white/40 font-body mb-3">AI reviews your week and replans your roadmap.</p>
              <CheckinButton token={token} />
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}

// ─── Check-in button ──────────────────────────────────────────────────────────

function CheckinButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [step, setStep] = useState<'idle' | 'answering' | 'done'>('idle')
  const [result, setResult] = useState('')

  async function fetchQuestions() {
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/agent/checkin-questions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.questions) {
        setQuestions(data.questions)
        setAnswers(new Array(data.questions.length).fill(''))
        setStep('answering')
      }
    } catch {
      // silent
    }
    setLoading(false)
  }

  async function submitAnswers() {
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/agent/submit-answers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, answers }),
      })
      const data = await res.json()
      setResult(data.message || 'Check-in complete!')
      setStep('done')
    } catch {
      setResult('Something went wrong. Try again.')
      setStep('done')
    }
    setLoading(false)
  }

  if (step === 'done') {
    return (
      <div className="text-xs text-emerald-400 font-body flex items-center gap-1.5">
        <CheckCircle2 size={12} /> {result}
      </div>
    )
  }

  if (step === 'answering') {
    return (
      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={i}>
            <p className="text-[11px] text-white/60 font-body mb-1">{q}</p>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
              placeholder="Your answer..."
              value={answers[i]}
              onChange={e => {
                const next = [...answers]
                next[i] = e.target.value
                setAnswers(next)
              }}
            />
          </div>
        ))}
        <Button
          onClick={submitAnswers}
          disabled={loading || answers.every(a => !a.trim())}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs h-7 rounded-lg font-heading"
        >
          {loading ? 'Processing...' : 'Submit'}
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={fetchQuestions}
      disabled={loading}
      variant="outline"
      className="w-full border-white/10 hover:border-violet-500/50 hover:bg-violet-500/10 text-white/60 hover:text-white text-xs h-7 rounded-lg font-body flex items-center gap-1.5"
    >
      <Clock size={11} />
      {loading ? 'Loading...' : 'Start check-in'}
    </Button>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatActivity(item: ActivityItem): string {
  const meta = item.metadata || {}
  switch (item.action_type) {
    case 'dsa_solved': return `Solved "${(meta.problem_title as string) || 'a DSA problem'}"`
    case 'course_progress': return `Updated "${(meta.course_name as string) || 'a course'}" progress`
    case 'task_completed': return `Completed roadmap task: "${(meta.task_title as string) || 'a task'}"`
    case 'challenge_joined': return `Joined challenge: "${(meta.challenge_title as string) || 'a challenge'}"`
    case 'friend_added': return 'Made a new connection'
    default: return item.action_type.replace(/_/g, ' ')
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, gradient, icon,
}: {
  label: string; value: string; sub: string; gradient: string; icon: React.ReactNode
}) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02, boxShadow: '0 8px 32px rgba(139,92,246,0.15)' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="bg-white/3 border border-white/8 rounded-2xl p-4 hover:border-white/20 transition-colors cursor-default"
    >
      <div className={`inline-flex items-center gap-1.5 text-xs font-body bg-gradient-to-r ${gradient} bg-clip-text text-transparent mb-2`}>
        <span className={`bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{icon}</span>
        {label}
      </div>
      <p className={`font-heading text-2xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{value}</p>
      <p className="text-white/30 text-xs mt-0.5 font-body">{sub}</p>
    </motion.div>
  )
}

function ModuleCard({
  icon, title, description, status, href, color,
}: {
  icon: React.ReactNode; title: string; description: string; status: string; href: string; color: string
}) {
  const isLive = status === 'live'

  const colorClasses: Record<string, { dot: string; hover: string }> = {
    blue:    { dot: 'bg-blue-400',    hover: 'hover:border-blue-500/40' },
    purple:  { dot: 'bg-purple-400',  hover: 'hover:border-purple-500/40' },
    emerald: { dot: 'bg-emerald-400', hover: 'hover:border-emerald-500/40' },
    cyan:    { dot: 'bg-cyan-400',    hover: 'hover:border-cyan-500/40' },
    orange:  { dot: 'bg-orange-400',  hover: 'hover:border-orange-500/30' },
    pink:    { dot: 'bg-pink-400',    hover: 'hover:border-pink-500/30' },
    rose:    { dot: 'bg-rose-400',    hover: 'hover:border-rose-500/30' },
    yellow:  { dot: 'bg-yellow-400',  hover: 'hover:border-yellow-500/30' },
    indigo:  { dot: 'bg-indigo-400',  hover: 'hover:border-indigo-500/40' },
  }
  const c = colorClasses[color] ?? colorClasses.blue

  const Inner = (
    <motion.div
      whileHover={isLive ? { y: -2, scale: 1.02, boxShadow: '0 6px 24px rgba(99,102,241,0.12)' } : {}}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`bg-white/3 border border-white/8 rounded-2xl p-4 transition-colors h-full ${isLive ? `cursor-pointer ${c.hover} hover:bg-white/5` : 'opacity-50'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`bg-gradient-to-br ${c.dot.replace('bg-', 'from-').replace('-400', '-400')} text-white/70`}>{icon}</div>
        {isLive ? (
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />
            <span className="text-xs text-white/40 font-body">Live</span>
          </div>
        ) : (
          <span className="text-xs text-white/20 font-body">{status}</span>
        )}
      </div>
      <h3 className="font-heading font-semibold text-white/90 text-sm mb-0.5">{title}</h3>
      <p className="font-body text-white/40 text-xs leading-relaxed">{description}</p>
    </motion.div>
  )

  if (isLive) return <a href={href}>{Inner}</a>
  return <div>{Inner}</div>
}
