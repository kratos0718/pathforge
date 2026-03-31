'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Compass, Map, Calculator, Code2, BookOpen, Users,
  Flame, Zap, LogOut, Bell, Trophy, Crown,
  CheckCircle2, Clock, Target, GraduationCap, ShieldCheck,
  TrendingUp, ArrowRight, Plus, RotateCcw, Sparkles, ArrowUpRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DailyTask } from '@/app/api/tasks/today/route'

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserProfile {
  name: string; target_role: string; semester: number
  college: string; xp: number; streak: number; tier: string
}
interface Notification { id: string; message: string; read: boolean; created_at: string }

// ─── Module config — each with its own vivid identity ────────────────────────
const MODULES = [
  {
    icon: Compass, title: 'Role Compass', desc: 'Find your best-fit career path with AI',
    href: '/compass',
    from: '#FF6B35', to: '#FF8C42', shadow: 'rgba(255,107,53,0.35)',
    text: 'text-orange-100',
  },
  {
    icon: Map, title: 'My Roadmap', desc: '16-week personalised placement plan',
    href: '/roadmap',
    from: '#7C3AED', to: '#9F67FF', shadow: 'rgba(124,58,237,0.35)',
    text: 'text-violet-100',
  },
  {
    icon: Code2, title: 'DSA Tracker', desc: 'Striver A2Z — 455 problems + XP',
    href: '/dsa',
    from: '#0EA5E9', to: '#38BDF8', shadow: 'rgba(14,165,233,0.35)',
    text: 'text-sky-100',
  },
  {
    icon: Calculator, title: 'CGPA Calculator', desc: 'Calculate CGPA, check company cutoffs',
    href: '/cgpa',
    from: '#059669', to: '#34D399', shadow: 'rgba(5,150,105,0.35)',
    text: 'text-emerald-100',
  },
  {
    icon: BookOpen, title: 'Course Tracker', desc: 'Track courses with velocity metrics',
    href: '/courses',
    from: '#D97706', to: '#FCD34D', shadow: 'rgba(217,119,6,0.35)',
    text: 'text-amber-100',
  },
  {
    icon: Users, title: 'Friends', desc: 'Batchmates, activity feed & leaderboards',
    href: '/friends',
    from: '#DB2777', to: '#F472B6', shadow: 'rgba(219,39,119,0.35)',
    text: 'text-pink-100',
  },
  {
    icon: Flame, title: 'Challenges', desc: 'Create challenges, compete live',
    href: '/challenges',
    from: '#DC2626', to: '#F87171', shadow: 'rgba(220,38,38,0.35)',
    text: 'text-red-100',
  },
  {
    icon: Trophy, title: 'Readiness Score', desc: 'Full placement readiness breakdown',
    href: '/score',
    from: '#7C3AED', to: '#C084FC', shadow: 'rgba(192,132,252,0.30)',
    text: 'text-purple-100',
  },
  {
    icon: GraduationCap, title: 'CSE Subjects', desc: 'OS, DBMS, CN, OOP, System Design paths',
    href: '/subjects',
    from: '#0891B2', to: '#22D3EE', shadow: 'rgba(8,145,178,0.35)',
    text: 'text-cyan-100',
  },
]

// ─── Tag colors ───────────────────────────────────────────────────────────────
const TAG: Record<string, string> = {
  blue:    'bg-sky-500/20 text-sky-300 border-sky-500/30',
  violet:  'bg-violet-500/20 text-violet-300 border-violet-500/30',
  purple:  'bg-purple-500/20 text-purple-300 border-purple-500/30',
  orange:  'bg-orange-500/20 text-orange-300 border-orange-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  rose:    'bg-rose-500/20 text-rose-300 border-rose-500/30',
  pink:    'bg-pink-500/20 text-pink-300 border-pink-500/30',
  cyan:    'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
function formatDate() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}
function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (d < 60) return `${d}m ago`
  if (d < 1440) return `${Math.floor(d / 60)}h ago`
  return `${Math.floor(d / 1440)}d ago`
}
function getTodayKey(uid: string) {
  return `pf_done_${uid}_${new Date().toISOString().split('T')[0]}`
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [tasksLoading, setTasksLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [dsaSolved, setDsaSolved] = useState(0)
  const [readinessScore, setReadinessScore] = useState<number | null>(null)
  const [addingTask, setAddingTask] = useState(false)
  const [customTask, setCustomTask] = useState('')
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

  const loadCompleted = useCallback((uid: string) => {
    try {
      const raw = localStorage.getItem(getTodayKey(uid))
      if (raw) setCompletedIds(new Set(JSON.parse(raw)))
    } catch { /* ignore */ }
  }, [])

  const saveCompleted = useCallback((uid: string, ids: Set<string>) => {
    try { localStorage.setItem(getTodayKey(uid), JSON.stringify(Array.from(ids))) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/auth'; return }
      setUserId(session.user.id)
      setUserEmail(session.user.email ?? '')
      loadCompleted(session.user.id)
      const { data } = await supabase.from('users')
        .select('name, target_role, semester, college, xp, streak, tier')
        .eq('id', session.user.id).single()
      setUser(data)
      setLoading(false)
      const tok = session.access_token
      fetch('/api/tasks/today').then(r => r.json()).then(d => { if (d.tasks) setTasks(d.tasks) }).finally(() => setTasksLoading(false))
      Promise.allSettled([
        fetch(`${BACKEND}/dsa/stats`, { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()).then(d => setDsaSolved(d.total_solved ?? 0)),
        fetch(`${BACKEND}/score/calculate`, { method: 'POST', headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()).then(d => { if (d.score !== undefined) setReadinessScore(d.score) }),
        supabase.from('notifications').select('*').eq('user_id', session.user.id).eq('read', false).order('created_at', { ascending: false }).limit(10).then(({ data: n }) => { if (n) setNotifications(n) }),
      ])
    }
    init()
  }, [loadCompleted, BACKEND])

  function toggleTask(id: string) {
    setCompletedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      saveCompleted(userId, next)
      return next
    })
  }
  function addCustomTask() {
    if (!customTask.trim()) return
    const t: DailyTask = {
      id: `custom-${Date.now()}`, title: customTask.trim(), subtitle: 'Custom task',
      category: 'meta', tag: 'Custom', tagColor: 'violet', xp: 10, minutes: 30, priority: 'medium',
    }
    setTasks(prev => [...prev, t])
    setCustomTask('')
    setAddingTask(false)
  }
  async function markNotifsRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    setNotifications([])
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1A0B2E 0%, #0D1B3E 50%, #1A0B2E 100%)' }}>
      <div className="flex gap-2">
        {[0, 120, 240].map(d => (
          <motion.span key={d} className="w-2.5 h-2.5 rounded-full"
            style={{ background: d === 0 ? '#FF6B35' : d === 120 ? '#7C3AED' : '#0EA5E9' }}
            animate={{ y: [0, -10, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, delay: d / 1000, repeat: Infinity, ease: 'easeInOut' }} />
        ))}
      </div>
    </div>
  )

  const level = Math.floor((user?.xp ?? 0) / 500) + 1
  const xpProgress = ((user?.xp ?? 0) % 500) / 500
  const unread = notifications.length
  const doneCount = tasks.filter(t => completedIds.has(t.id)).length
  const totalXpToday = tasks.filter(t => completedIds.has(t.id)).reduce((a, t) => a + t.xp, 0)
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map(e => e.trim())

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden"
      style={{ background: 'linear-gradient(135deg, #1A0B2E 0%, #0D1B3E 55%, #1A0B2E 100%)' }}>

      {/* ── Background: grid + vivid orbs ───────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        {/* Subtle dot grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />
        {/* Orb 1 — hot orange top-left */}
        <motion.div animate={{ x: [0, 40, 0], y: [0, -25, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,107,53,0.28) 0%, transparent 65%)' }} />
        {/* Orb 2 — violet top-right */}
        <motion.div animate={{ x: [0, -30, 0], y: [0, 25, 0] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-20 -right-40 w-[750px] h-[750px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.30) 0%, transparent 65%)' }} />
        {/* Orb 3 — sky blue bottom-center */}
        <motion.div animate={{ x: [0, 25, 0], y: [0, -20, 0] }} transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 65%)' }} />
        {/* Orb 4 — pink mid-left accent */}
        <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 -left-20 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(219,39,119,0.12) 0%, transparent 65%)' }} />
      </div>

      {/* ── Floating Nav ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 px-4 pt-4 pb-2">
        <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.2, 0.7, 0.4, 1] }}
          className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3 rounded-2xl border border-white/8"
          style={{ background: 'rgba(12,12,24,0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #7C3AED 100%)' }}>
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="font-heading font-extrabold text-white tracking-tight text-lg">PathForge</span>
            {user?.tier === 'premium' && (
              <span className="text-[10px] bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <Crown size={8} /> PRO
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <motion.div whileHover={{ scale: 1.05 }}
              className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 border"
              style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)' }}>
              <Flame size={12} className="text-orange-400 fill-orange-400" />
              <span className="text-orange-400 text-xs font-heading font-bold">{user?.streak ?? 0}d</span>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }}
              className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 border"
              style={{ background: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.25)' }}>
              <Zap size={12} className="text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-400 text-xs font-heading font-bold">{user?.xp ?? 0} XP</span>
              <span className="text-yellow-500/50 text-xs">Lv{level}</span>
            </motion.div>
            <a href="/subjects" className="hidden md:flex items-center gap-1.5 text-white/30 hover:text-white/70 text-xs transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5">
              <GraduationCap size={13} /> Subjects
            </a>
            {adminEmails.includes(userEmail) && (
              <a href="/admin" className="hidden md:flex items-center gap-1.5 text-rose-400/50 hover:text-rose-400 text-xs transition-colors px-2 py-1.5 rounded-lg hover:bg-rose-500/5">
                <ShieldCheck size={13} /> Admin
              </a>
            )}
            {/* Bell */}
            <div className="relative">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                onClick={() => { setShowNotifs(v => !v); if (!showNotifs && unread > 0) markNotifsRead() }}
                className="relative p-2 rounded-xl hover:bg-white/8 transition-colors">
                <Bell size={15} className="text-white/40" />
                <AnimatePresence>
                  {unread > 0 && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 rounded-full text-[9px] font-bold flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
              <AnimatePresence>
                {showNotifs && (
                  <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 w-72 rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-50"
                    style={{ background: 'rgba(14,14,28,0.97)', backdropFilter: 'blur(20px)' }}>
                    <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                      <span className="text-sm font-heading font-semibold">Notifications</span>
                      <button onClick={() => setShowNotifs(false)} className="text-white/30 hover:text-white text-xs">✕</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0
                        ? <p className="text-white/30 text-xs text-center py-6">All caught up ✓</p>
                        : notifications.map(n => (
                          <div key={n.id} className="px-4 py-3 border-b border-white/5">
                            <p className="text-sm text-white/80 leading-snug">{n.message}</p>
                            <p className="text-xs text-white/25 mt-1">{timeAgo(n.created_at)}</p>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={async () => { await supabase.auth.signOut(); window.location.href = '/auth' }}
              className="flex items-center gap-1.5 text-white/25 hover:text-white/60 text-xs transition-colors px-2 py-1.5 rounded-xl hover:bg-white/5">
              <LogOut size={13} /> <span className="hidden sm:inline">Sign out</span>
            </motion.button>
          </div>
        </motion.nav>
      </div>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.55 }}>
          <p className="text-white/70 text-sm font-body mb-2 tracking-wide">{formatDate()}</p>
          <h1 className="font-heading font-extrabold leading-[1.05] tracking-tight">
            <span className="block text-white/85 text-2xl sm:text-3xl">{getGreeting()},</span>
            <span className="block text-4xl sm:text-6xl animate-gradient-title">{user?.name?.split(' ')[0] ?? 'there'} 👋</span>
          </h1>
          <p className="text-white/75 font-body text-sm mt-3 flex items-center gap-2 flex-wrap">
            <span>{user?.college}</span>
            <span className="text-white/40">·</span>
            <span>Semester {user?.semester}</span>
            <span className="text-white/40">·</span>
            <span className="font-semibold" style={{ color: '#FF6B35' }}>Targeting {user?.target_role ?? 'SDE'}</span>
          </p>
        </motion.div>

        {/* ── Stats Strip ───────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.45 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Level', value: `Lv ${level}`, sub: `${user?.xp ?? 0} XP total`, from: '#F59E0B', to: '#EF4444', icon: <Zap size={14} /> },
            { label: 'Streak', value: `${user?.streak ?? 0}d`, sub: 'current streak', from: '#FF6B35', to: '#EF4444', icon: <Flame size={14} /> },
            { label: 'DSA Solved', value: String(dsaSolved), sub: `of 455 problems`, from: '#0EA5E9', to: '#7C3AED', icon: <Code2 size={14} /> },
            {
              label: 'Readiness', value: readinessScore !== null ? `${Math.round(readinessScore)}%` : '—',
              sub: readinessScore !== null ? (readinessScore >= 70 ? 'Placement ready 🚀' : 'Keep grinding') : 'Not calculated',
              from: '#059669', to: '#0EA5E9', icon: <TrendingUp size={14} />,
            },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 + i * 0.06 }}
              whileHover={{ y: -4, boxShadow: `0 16px 40px rgba(0,0,0,0.4)` }}
              className="relative overflow-hidden rounded-2xl p-4 border border-white/8 cursor-default"
              style={{ background: `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)` }}>
              {/* Color accent bar top */}
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${s.from}, ${s.to})` }} />
              <div className="flex items-center gap-1.5 mb-3" style={{ color: s.from }}>
                {s.icon}
                <span className="text-xs font-body text-white/75">{s.label}</span>
              </div>
              <p className="font-heading text-2xl font-extrabold text-white">{s.value}</p>
              <p className="text-white/65 text-[11px] mt-0.5 font-body">{s.sub}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

          {/* ── Today's Forge ─────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.22, duration: 0.5 }}>
            {/* Section header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)' }}>
                  <Target size={15} className="text-white" />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-white text-lg">Today&apos;s Forge</h2>
                  {!tasksLoading && (
                    <p className="text-white/70 text-xs font-body">
                      {doneCount}/{tasks.length} done
                      {totalXpToday > 0 && <span className="text-yellow-400/80 ml-2">· +{totalXpToday} XP earned</span>}
                    </p>
                  )}
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.1, rotate: 180 }} whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.3 }}
                onClick={() => { setTasksLoading(true); fetch('/api/tasks/today').then(r => r.json()).then(d => { if (d.tasks) setTasks(d.tasks) }).finally(() => setTasksLoading(false)) }}
                className="p-2 rounded-xl hover:bg-white/8 text-white/20 hover:text-white/60 transition-colors">
                <RotateCcw size={14} />
              </motion.button>
            </div>

            {/* XP bar */}
            <div className="mb-5 p-3.5 rounded-2xl border border-white/6"
              style={{ background: 'rgba(255,255,255,0.025)' }}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-[11px] text-white/80 font-body">Level {level}</span>
                </div>
                <span className="text-[11px] text-white/65 font-body">{500 - ((user?.xp ?? 0) % 500)} XP to next level</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #FF6B35, #7C3AED, #0EA5E9)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress * 100}%` }}
                  transition={{ duration: 1.2, delay: 0.6, ease: [0.2, 0.7, 0.4, 1] }} />
              </div>
            </div>

            {/* Tasks */}
            <div className="space-y-3">
              {tasksLoading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="h-[84px] rounded-2xl border border-white/5 animate-pulse"
                    style={{ background: 'rgba(255,255,255,0.025)', animationDelay: `${i * 80}ms` }} />
                ))
              ) : (
                <AnimatePresence mode="popLayout">
                  {tasks.map((task, i) => {
                    const done = completedIds.has(task.id)
                    return (
                      <motion.div key={task.id}
                        initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16, scale: 0.96 }}
                        transition={{ delay: i * 0.07, duration: 0.32 }}
                        whileHover={done ? {} : { y: -2, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}
                        onClick={() => toggleTask(task.id)}
                        className={`group flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer select-none transition-all duration-200 ${
                          done
                            ? 'border-white/4 opacity-40'
                            : 'border-white/8 hover:border-white/16'
                        }`}
                        style={{ background: done ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.04)' }}>

                        {/* Checkbox */}
                        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
                          done ? 'border-emerald-500 bg-emerald-500' : 'border-white/20 group-hover:border-violet-400/70'
                        }`}>
                          <AnimatePresence>
                            {done && (
                              <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </motion.svg>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`text-sm font-heading font-semibold transition-all ${done ? 'line-through text-white/20' : 'text-white/90'}`}>
                              {task.title}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-body ${TAG[task.tagColor] ?? TAG.violet}`}>
                              {task.tag}
                            </span>
                            {task.priority === 'high' && !done && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-body"
                                style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                                Priority
                              </span>
                            )}
                          </div>
                          <p className={`text-xs font-body ${done ? 'text-white/20' : 'text-white/75'}`}>{task.subtitle}</p>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1.5 ml-2">
                          <div className="flex items-center gap-1" style={{ color: done ? 'rgba(234,179,8,0.3)' : '#FBBF24' }}>
                            <Zap size={9} />
                            <span className="text-[10px] font-heading">{task.xp}</span>
                          </div>
                          <div className="flex items-center gap-1 text-white/60">
                            <Clock size={9} />
                            <span className="text-[10px] font-body">{task.minutes}m</span>
                          </div>
                          {task.link && !done && (
                            <a href={task.link} onClick={e => e.stopPropagation()}
                              className="flex items-center gap-0.5 text-[10px] text-violet-400/50 hover:text-violet-400 transition-colors">
                              Go <ArrowUpRight size={8} />
                            </a>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              )}

              {/* Add custom task */}
              <AnimatePresence>
                {addingTask ? (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="flex gap-2">
                    <input autoFocus value={customTask} onChange={e => setCustomTask(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addCustomTask(); if (e.key === 'Escape') { setAddingTask(false); setCustomTask('') } }}
                      placeholder="Add a task..."
                      className="flex-1 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none font-body border border-white/10 focus:border-violet-500/60"
                      style={{ background: 'rgba(255,255,255,0.05)' }} />
                    <button onClick={addCustomTask}
                      className="px-4 py-2.5 text-white text-sm rounded-xl font-heading transition-colors"
                      style={{ background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)' }}>
                      Add
                    </button>
                    <button onClick={() => { setAddingTask(false); setCustomTask('') }}
                      className="px-3 py-2.5 text-white/30 hover:text-white text-sm rounded-xl hover:bg-white/5 transition-colors">✕</button>
                  </motion.div>
                ) : (
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => setAddingTask(true)}
                    className="w-full flex items-center gap-2 px-4 py-3.5 rounded-2xl border border-dashed border-white/10 hover:border-violet-500/40 text-white/25 hover:text-violet-400 text-sm transition-all font-body">
                    <Plus size={14} /> Add custom task
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* All done banner */}
            <AnimatePresence>
              {doneCount > 0 && doneCount === tasks.length && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="mt-4 rounded-2xl p-4 text-center border"
                  style={{ background: 'rgba(5,150,105,0.12)', borderColor: 'rgba(5,150,105,0.3)' }}>
                  <p className="text-emerald-400 font-heading font-bold">🎉 All done for today!</p>
                  <p className="text-emerald-400/50 text-xs mt-1 font-body">+{totalXpToday} XP · Streak maintained</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── Right Sidebar ──────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28, duration: 0.5 }}
            className="space-y-5">

            {/* Score Ring */}
            <div className="rounded-2xl p-5 border border-white/8 flex flex-col items-center"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-xs text-white/70 font-body uppercase tracking-widest mb-4">Readiness Score</p>
              {readinessScore !== null ? (
                <>
                  <div className="relative w-28 h-28 mb-3">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                      <motion.circle cx="50" cy="50" r="42" fill="none"
                        stroke={readinessScore >= 70 ? '#10b981' : readinessScore >= 50 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="7" strokeLinecap="round"
                        initial={{ pathLength: 0 }} animate={{ pathLength: readinessScore / 100 }}
                        transition={{ duration: 1.4, delay: 0.8, ease: [0.2, 0.7, 0.4, 1] }}
                        strokeDasharray="1 0" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-heading text-3xl font-extrabold text-white">{Math.round(readinessScore)}</span>
                      <span className="text-[10px] text-white/60">/100</span>
                    </div>
                  </div>
                  <p className="text-xs text-white/75 font-body text-center">
                    {readinessScore >= 80 ? 'Placement ready 🚀' : readinessScore >= 60 ? 'Good progress 📈' : readinessScore >= 40 ? 'Stay consistent 💪' : 'Time to grind 🔥'}
                  </p>
                  <a href="/score" className="mt-3 text-[11px] text-violet-400/60 hover:text-violet-400 flex items-center gap-1 transition-colors">
                    Full breakdown <ArrowRight size={9} />
                  </a>
                </>
              ) : (
                <div className="text-center py-2">
                  <p className="text-white/60 text-xs mb-3">Not yet calculated</p>
                  <a href="/score" className="text-xs px-4 py-2 rounded-xl font-body transition-colors border border-violet-500/30 text-violet-400 hover:bg-violet-500/10">
                    Calculate now →
                  </a>
                </div>
              )}
            </div>

            {/* Upgrade */}
            {user?.tier !== 'premium' && (
              <motion.a href="/upgrade" whileHover={{ scale: 1.02 }}
                className="block rounded-2xl p-4 border border-yellow-500/20 cursor-pointer transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.15) 0%, rgba(220,38,38,0.10) 100%)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Crown size={14} className="text-yellow-400" />
                  <span className="text-sm font-heading font-bold text-yellow-400">Go Premium</span>
                  <span className="ml-auto text-[10px] text-yellow-400/50 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">₹99/mo</span>
                </div>
                <p className="text-xs text-white/75 font-body">AI weekly check-ins · unlimited DSA · adaptive replanning</p>
              </motion.a>
            )}

            {/* Weekly check-in */}
            <CheckinPanel />
          </motion.div>
        </div>

        {/* ── Modules Grid — BIG, bold, colorful ─────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="font-heading font-bold text-white text-xl">Modules</h2>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, transparent 100%)' }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULES.map((m, i) => (
              <motion.a key={m.title} href={m.href}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 + i * 0.05, duration: 0.35 }}
                whileHover={{ y: -5, boxShadow: `0 20px 48px ${m.shadow}` }}
                whileTap={{ scale: 0.97 }}
                className="group relative overflow-hidden rounded-2xl p-5 border border-white/8 flex items-start gap-4 transition-all duration-250"
                style={{ background: 'rgba(255,255,255,0.035)' }}>

                {/* Hover color fill */}
                <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: `linear-gradient(135deg, ${m.from}14 0%, ${m.to}0A 100%)` }} />

                {/* Colored icon box */}
                <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                  style={{ background: `linear-gradient(135deg, ${m.from}, ${m.to})`, boxShadow: `0 4px 16px ${m.shadow}` }}>
                  <m.icon size={22} className="text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-bold text-white text-base leading-tight group-hover:text-white transition-colors">{m.title}</h3>
                  <p className="text-white/75 text-xs font-body mt-1 leading-relaxed">{m.desc}</p>
                </div>

                {/* Arrow */}
                <ArrowUpRight size={16} className="shrink-0 text-white/15 group-hover:text-white/60 transition-colors mt-0.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
              </motion.a>
            ))}
          </div>
        </motion.div>

      </main>
    </div>
  )
}

// ─── Weekly Check-in Panel ────────────────────────────────────────────────────
function CheckinPanel() {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
  const [step, setStep] = useState<'idle' | 'answering' | 'done'>('idle')
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [result, setResult] = useState('')

  async function start() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const r = await fetch(`${BACKEND}/agent/checkin-questions`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      const d = await r.json()
      if (d.questions) { setQuestions(d.questions); setAnswers(new Array(d.questions.length).fill('')); setStep('answering') }
    } catch { setResult('Backend unavailable.'); setStep('done') }
    setLoading(false)
  }
  async function submit() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const r = await fetch(`${BACKEND}/agent/submit-answers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, answers }),
      })
      const d = await r.json()
      setResult(d.message || 'Check-in complete!')
    } catch { setResult('Something went wrong.') }
    setStep('done')
    setLoading(false)
  }

  return (
    <div className="rounded-2xl p-4 border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)' }}>
          <CheckCircle2 size={12} className="text-white" />
        </div>
        <span className="text-sm font-heading font-semibold text-white/90">Weekly Check-in</span>
      </div>
      {step === 'done' ? (
        <p className="text-xs text-emerald-400 font-body flex items-center gap-1.5"><CheckCircle2 size={11} /> {result}</p>
      ) : step === 'answering' ? (
        <div className="space-y-2.5">
          {questions.map((q, i) => (
            <div key={i}>
              <p className="text-[11px] text-white/45 mb-1 font-body">{q}</p>
              <input value={answers[i]} onChange={e => { const n = [...answers]; n[i] = e.target.value; setAnswers(n) }}
                className="w-full rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none border border-white/10 focus:border-violet-500/50 font-body"
                style={{ background: 'rgba(255,255,255,0.05)' }} placeholder="Your answer..." />
            </div>
          ))}
          <button onClick={submit} disabled={loading || answers.every(a => !a.trim())}
            className="w-full text-white text-xs h-8 rounded-xl font-heading transition-colors disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)' }}>
            {loading ? 'Processing...' : 'Submit'}
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-white/30 font-body mb-3">AI reviews your week and replans your roadmap.</p>
          <button onClick={start} disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 border border-white/10 hover:border-violet-500/40 hover:bg-violet-500/8 text-white/40 hover:text-white/80 text-xs h-9 rounded-xl font-body transition-all">
            <Clock size={11} /> {loading ? 'Loading...' : 'Start check-in'}
          </button>
        </>
      )}
    </div>
  )
}
