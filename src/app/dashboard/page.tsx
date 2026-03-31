'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Compass, Map, Calculator, Code2, BookOpen, Users,
  Flame, Zap, LogOut, Bell, Trophy, Crown,
  CheckCircle2, Clock, Target, GraduationCap, ShieldCheck,
  TrendingUp, ArrowRight, Plus, RotateCcw, Sparkles,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DailyTask } from '@/app/api/tasks/today/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  name: string; target_role: string; semester: number
  college: string; xp: number; streak: number; tier: string
}
interface Notification { id: string; message: string; read: boolean; created_at: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  blue:    'bg-blue-500/15 text-blue-400 border-blue-500/25',
  violet:  'bg-violet-500/15 text-violet-400 border-violet-500/25',
  purple:  'bg-purple-500/15 text-purple-400 border-purple-500/25',
  orange:  'bg-orange-500/15 text-orange-400 border-orange-500/25',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  rose:    'bg-rose-500/15 text-rose-400 border-rose-500/25',
  pink:    'bg-pink-500/15 text-pink-400 border-pink-500/25',
  cyan:    'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
}

const MODULES = [
  { icon: Compass,     title: 'Role Compass',     href: '/compass',   color: 'blue' },
  { icon: Map,         title: 'Roadmap',           href: '/roadmap',   color: 'purple' },
  { icon: Code2,       title: 'DSA Tracker',       href: '/dsa',       color: 'cyan' },
  { icon: Calculator,  title: 'CGPA',              href: '/cgpa',      color: 'emerald' },
  { icon: BookOpen,    title: 'Courses',           href: '/courses',   color: 'orange' },
  { icon: Users,       title: 'Friends',           href: '/friends',   color: 'pink' },
  { icon: Flame,       title: 'Challenges',        href: '/challenges',color: 'rose' },
  { icon: Trophy,      title: 'Score',             href: '/score',     color: 'yellow' },
  { icon: GraduationCap, title: 'CSE Subjects',   href: '/subjects',  color: 'indigo' },
]

const MODULE_ACCENT: Record<string, string> = {
  blue:    'group-hover:text-blue-400 group-hover:border-blue-500/40',
  purple:  'group-hover:text-purple-400 group-hover:border-purple-500/40',
  cyan:    'group-hover:text-cyan-400 group-hover:border-cyan-500/40',
  emerald: 'group-hover:text-emerald-400 group-hover:border-emerald-500/40',
  orange:  'group-hover:text-orange-400 group-hover:border-orange-500/40',
  pink:    'group-hover:text-pink-400 group-hover:border-pink-500/40',
  rose:    'group-hover:text-rose-400 group-hover:border-rose-500/40',
  yellow:  'group-hover:text-yellow-400 group-hover:border-yellow-500/40',
  indigo:  'group-hover:text-indigo-400 group-hover:border-indigo-500/40',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (d < 60) return `${d}m ago`
  if (d < 1440) return `${Math.floor(d / 60)}h ago`
  return `${Math.floor(d / 1440)}d ago`
}

function getTodayKey(userId: string) {
  return `pf_done_${userId}_${new Date().toISOString().split('T')[0]}`
}

// ─── Main Component ───────────────────────────────────────────────────────────

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

  // Load completed tasks from localStorage
  const loadCompleted = useCallback((uid: string) => {
    try {
      const raw = localStorage.getItem(getTodayKey(uid))
      if (raw) setCompletedIds(new Set(JSON.parse(raw)))
    } catch { /* ignore */ }
  }, [])

  const saveCompleted = useCallback((uid: string, ids: Set<string>) => {
    try {
      localStorage.setItem(getTodayKey(uid), JSON.stringify(Array.from(ids)))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/auth'; return }

      setUserId(session.user.id)
      setUserEmail(session.user.email ?? '')
      loadCompleted(session.user.id)

      // Fetch profile
      const { data } = await supabase.from('users')
        .select('name, target_role, semester, college, xp, streak, tier')
        .eq('id', session.user.id).single()
      setUser(data)
      setLoading(false)

      const tok = session.access_token

      // Fetch today's tasks
      fetch('/api/tasks/today')
        .then(r => r.json())
        .then(d => { if (d.tasks) setTasks(d.tasks) })
        .finally(() => setTasksLoading(false))

      // Fetch DSA + score + notifications in parallel
      Promise.allSettled([
        fetch(`${BACKEND}/dsa/stats`, { headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.json()).then(d => setDsaSolved(d.total_solved ?? 0)),
        fetch(`${BACKEND}/score/calculate`, { method: 'POST', headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.json()).then(d => { if (d.score !== undefined) setReadinessScore(d.score) }),
        supabase.from('notifications').select('*')
          .eq('user_id', session.user.id).eq('read', false)
          .order('created_at', { ascending: false }).limit(10)
          .then(({ data: n }) => { if (n) setNotifications(n) }),
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
      id: `custom-${Date.now()}`,
      title: customTask.trim(),
      subtitle: 'Custom task — added by you',
      category: 'meta', tag: 'Custom', tagColor: 'violet',
      xp: 10, minutes: 30, priority: 'medium',
    }
    setTasks(prev => [...prev, t])
    setCustomTask('')
    setAddingTask(false)
  }

  async function markNotifsRead() {
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', userId).eq('read', false)
    setNotifications([])
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080812] flex items-center justify-center">
      <div className="flex gap-1.5">
        {[0, 120, 240].map(d => (
          <motion.span key={d} className="w-2 h-2 bg-violet-400/40 rounded-full"
            animate={{ y: [0, -8, 0] }} transition={{ duration: 0.8, delay: d / 1000, repeat: Infinity, ease: 'easeInOut' }} />
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
    <div className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(139,92,246,0.08) 0%, transparent 60%), #080812' }}>

      {/* ── Floating Nav ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 px-4 pt-4 pb-2">
        <motion.nav
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.2, 0.7, 0.4, 1] }}
          className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3 rounded-2xl border border-white/8"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
              <Sparkles size={12} className="text-white" />
            </div>
            <span className="font-heading font-bold text-white tracking-tight">PathForge</span>
            {user?.tier === 'premium' && (
              <span className="text-[10px] bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <Crown size={8} /> PRO
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            {/* Streak */}
            <motion.div whileHover={{ scale: 1.05 }}
              className="hidden sm:flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1.5">
              <Flame size={12} className="text-orange-400 fill-orange-400" />
              <span className="text-orange-400 text-xs font-heading font-semibold">{user?.streak ?? 0}d</span>
            </motion.div>

            {/* XP pill */}
            <motion.div whileHover={{ scale: 1.05 }}
              className="hidden sm:flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-3 py-1.5">
              <Zap size={12} className="text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-400 text-xs font-heading font-semibold">{user?.xp ?? 0} XP</span>
              <span className="text-yellow-400/40 text-xs">Lv{level}</span>
            </motion.div>

            {/* Subjects */}
            <a href="/subjects" className="hidden md:flex items-center gap-1.5 text-white/30 hover:text-white/70 text-xs transition-colors px-2 py-1.5">
              <GraduationCap size={13} /> <span>Subjects</span>
            </a>

            {/* Admin link */}
            {adminEmails.includes(userEmail) && (
              <a href="/admin" className="hidden md:flex items-center gap-1.5 text-rose-400/50 hover:text-rose-400 text-xs transition-colors px-2 py-1.5">
                <ShieldCheck size={13} /> <span>Admin</span>
              </a>
            )}

            {/* Notifications */}
            <div className="relative">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                onClick={() => { setShowNotifs(v => !v); if (!showNotifs && unread > 0) markNotifsRead() }}
                className="relative p-2 rounded-xl hover:bg-white/8 transition-colors">
                <Bell size={15} className="text-white/50" />
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
                    exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute right-0 top-12 w-72 rounded-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden z-50"
                    style={{ background: 'rgba(20,20,35,0.95)', backdropFilter: 'blur(20px)' }}>
                    <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                      <span className="text-sm font-heading font-semibold">Notifications</span>
                      <button onClick={() => setShowNotifs(false)} className="text-white/30 hover:text-white text-xs">✕</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0
                        ? <p className="text-white/30 text-xs text-center py-6">All caught up ✓</p>
                        : notifications.map(n => (
                          <div key={n.id} className="px-4 py-3 border-b border-white/5">
                            <p className="text-sm text-white/80 font-body leading-snug">{n.message}</p>
                            <p className="text-xs text-white/25 mt-1">{timeAgo(n.created_at)}</p>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-white/25 hover:text-white/60 text-xs transition-colors px-2 py-1.5 rounded-xl hover:bg-white/5">
              <LogOut size={13} /> <span className="hidden sm:inline">Sign out</span>
            </motion.button>
          </div>
        </motion.nav>
      </div>

      {/* ── Main Layout ───────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── Hero Header ─────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
          <p className="text-white/30 text-sm font-body mb-1">{formatDate()}</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold leading-tight">
            <span className="text-white/50">{getGreeting()}, </span>
            <span className="animate-gradient-title">{user?.name?.split(' ')[0] ?? 'there'}</span>
            <span className="text-white"> 👋</span>
          </h1>
          <p className="text-white/30 font-body text-sm mt-1">
            {user?.college} · Semester {user?.semester} · Targeting <span className="text-violet-400">{user?.target_role ?? 'SDE'}</span>
          </p>
        </motion.div>

        {/* ── Quick Stats Strip ────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Level', value: `Lv ${level}`, sub: `${user?.xp ?? 0} XP total`, color: 'from-yellow-400 to-orange-400', icon: <Zap size={13} /> },
            { label: 'Streak', value: `${user?.streak ?? 0}d`, sub: 'current streak', color: 'from-orange-400 to-rose-400', icon: <Flame size={13} /> },
            { label: 'DSA Solved', value: dsaSolved.toString(), sub: 'of 455 problems', color: 'from-blue-400 to-cyan-400', icon: <Code2 size={13} /> },
            {
              label: 'Readiness', value: readinessScore !== null ? `${Math.round(readinessScore)}%` : '—',
              sub: readinessScore !== null ? (readinessScore >= 70 ? 'Placement ready 🚀' : readinessScore >= 50 ? 'Good progress' : 'Keep grinding') : 'Not calculated',
              color: 'from-emerald-400 to-teal-400', icon: <TrendingUp size={13} />
            },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05, duration: 0.35 }}
              whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }}
              className="bg-white/3 border border-white/8 rounded-2xl p-4 cursor-default transition-all duration-200">
              <div className={`flex items-center gap-1.5 text-xs font-body bg-gradient-to-r ${s.color} bg-clip-text text-transparent mb-2`}>
                <span className={`bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.icon}</span>
                {s.label}
              </div>
              <p className={`font-heading text-2xl font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
              <p className="text-white/25 text-[11px] mt-0.5 font-body">{s.sub}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Two-column: Today's Forge + Modules ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── Today's Forge (Todo List) ──────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.45 }}
            className="lg:col-span-3 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Target size={15} className="text-violet-400" />
                  <h2 className="font-heading font-semibold text-white">Today&apos;s Forge</h2>
                  {!tasksLoading && tasks.length > 0 && (
                    <span className="text-xs text-violet-400/70 font-body">
                      {doneCount}/{tasks.length} done
                    </span>
                  )}
                </div>
                {totalXpToday > 0 && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-xs text-yellow-400/70 mt-0.5 font-body flex items-center gap-1">
                    <Zap size={10} className="fill-yellow-400 text-yellow-400" />
                    +{totalXpToday} XP earned today
                  </motion.p>
                )}
              </div>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                onClick={() => { setTasksLoading(true); fetch('/api/tasks/today').then(r => r.json()).then(d => { if (d.tasks) setTasks(d.tasks) }).finally(() => setTasksLoading(false)) }}
                className="p-2 rounded-xl hover:bg-white/8 text-white/25 hover:text-white/60 transition-colors">
                <RotateCcw size={13} />
              </motion.button>
            </div>

            {/* XP Progress Bar */}
            <div className="mb-4 bg-white/4 rounded-2xl p-3 border border-white/6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-white/40 font-body">Level {level} → Level {level + 1}</span>
                <span className="text-[11px] text-white/40 font-body">{500 - ((user?.xp ?? 0) % 500)} XP to next</span>
              </div>
              <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress * 100}%` }}
                  transition={{ duration: 1, delay: 0.5, ease: [0.2, 0.7, 0.4, 1] }} />
              </div>
            </div>

            {/* Task List */}
            <div className="flex-1 space-y-2.5">
              {tasksLoading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white/3 border border-white/6 rounded-2xl h-[72px] animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                ))
              ) : (
                <AnimatePresence mode="popLayout">
                  {tasks.map((task, i) => {
                    const done = completedIds.has(task.id)
                    return (
                      <motion.div key={task.id}
                        initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12, scale: 0.95 }}
                        transition={{ delay: i * 0.06, duration: 0.3, ease: 'easeOut' }}
                        whileHover={{ y: -1 }}
                        className={`group flex items-start gap-3 p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none ${
                          done
                            ? 'bg-white/2 border-white/4 opacity-50'
                            : 'bg-white/4 border-white/8 hover:border-white/16 hover:bg-white/6'
                        }`}
                        onClick={() => toggleTask(task.id)}
                      >
                        {/* Checkbox */}
                        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
                          done
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-white/20 group-hover:border-violet-400/60'
                        }`}>
                          <AnimatePresence>
                            {done && (
                              <motion.svg initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </motion.svg>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-heading font-semibold transition-all duration-200 ${done ? 'line-through text-white/25' : 'text-white/90'}`}>
                              {task.title}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-body shrink-0 ${TAG_COLORS[task.tagColor] ?? TAG_COLORS.violet}`}>
                              {task.tag}
                            </span>
                            {task.priority === 'high' && !done && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-body shrink-0">
                                Priority
                              </span>
                            )}
                          </div>
                          <p className={`text-xs font-body mt-0.5 transition-all duration-200 ${done ? 'text-white/20' : 'text-white/40'}`}>
                            {task.subtitle}
                          </p>
                        </div>

                        {/* Meta */}
                        <div className="shrink-0 flex flex-col items-end gap-1 ml-1">
                          <div className="flex items-center gap-1 text-yellow-400/60">
                            <Zap size={9} className="fill-yellow-400/60" />
                            <span className="text-[10px] font-heading">{task.xp}</span>
                          </div>
                          <div className="flex items-center gap-1 text-white/20">
                            <Clock size={9} />
                            <span className="text-[10px] font-body">{task.minutes}m</span>
                          </div>
                          {task.link && !done && (
                            <a href={task.link} onClick={e => e.stopPropagation()}
                              className="text-[10px] text-violet-400/50 hover:text-violet-400 flex items-center gap-0.5 transition-colors">
                              Open <ArrowRight size={8} />
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
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="flex gap-2">
                    <input autoFocus value={customTask} onChange={e => setCustomTask(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addCustomTask(); if (e.key === 'Escape') { setAddingTask(false); setCustomTask('') } }}
                      placeholder="Add a custom task..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 font-body" />
                    <motion.button whileTap={{ scale: 0.95 }} onClick={addCustomTask}
                      className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-xl font-heading transition-colors">
                      Add
                    </motion.button>
                    <button onClick={() => { setAddingTask(false); setCustomTask('') }} className="px-3 py-2.5 text-white/30 hover:text-white text-sm rounded-xl hover:bg-white/5 transition-colors">
                      ✕
                    </button>
                  </motion.div>
                ) : (
                  <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => setAddingTask(true)}
                    className="w-full flex items-center gap-2 px-4 py-3 border border-dashed border-white/10 hover:border-violet-500/40 rounded-2xl text-white/25 hover:text-violet-400 text-sm transition-all duration-200 font-body">
                    <Plus size={14} /> Add custom task
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Daily completion summary */}
            {doneCount > 0 && doneCount === tasks.length && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="mt-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 text-center">
                <p className="text-emerald-400 font-heading font-semibold text-sm">All tasks done! 🎉</p>
                <p className="text-emerald-400/60 text-xs mt-0.5 font-body">+{totalXpToday} XP earned · Streak maintained</p>
              </motion.div>
            )}
          </motion.div>

          {/* ── Right Panel: Modules ───────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.45 }}
            className="lg:col-span-2 space-y-4">

            {/* Modules Grid */}
            <div>
              <h2 className="font-heading text-xs text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span className="w-3 h-px bg-white/20" /> Modules
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {MODULES.map((m, i) => (
                  <motion.a key={m.title} href={m.href}
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.35 + i * 0.04, duration: 0.3 }}
                    whileHover={{ y: -3, scale: 1.04 }} whileTap={{ scale: 0.97 }}
                    className={`group flex flex-col items-center gap-1.5 p-3 bg-white/3 border border-white/6 rounded-xl hover:bg-white/6 transition-all duration-200 ${MODULE_ACCENT[m.color]}`}>
                    <m.icon size={17} className="text-white/40 group-hover:scale-110 transition-transform duration-200" />
                    <span className="text-[10px] font-body text-white/35 text-center leading-tight">{m.title}</span>
                  </motion.a>
                ))}
              </div>
            </div>

            {/* Readiness score ring */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-5 flex flex-col items-center">
              <p className="text-xs text-white/30 font-body uppercase tracking-widest mb-4">Readiness Score</p>
              {readinessScore !== null ? (
                <>
                  <div className="relative w-28 h-28">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                      <motion.circle cx="50" cy="50" r="42" fill="none"
                        stroke={readinessScore >= 70 ? '#10b981' : readinessScore >= 50 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="7" strokeLinecap="round"
                        initial={{ pathLength: 0 }} animate={{ pathLength: readinessScore / 100 }}
                        transition={{ duration: 1.2, delay: 0.6, ease: [0.2, 0.7, 0.4, 1] }}
                        strokeDasharray="1 0" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-heading text-2xl font-bold text-white">{Math.round(readinessScore)}</span>
                      <span className="text-[10px] text-white/30 font-body">/100</span>
                    </div>
                  </div>
                  <p className="text-xs text-white/40 font-body text-center mt-3">
                    {readinessScore >= 80 ? 'Placement ready 🚀' : readinessScore >= 60 ? 'Good progress 📈' : readinessScore >= 40 ? 'Stay consistent 💪' : 'Time to grind 🔥'}
                  </p>
                  <a href="/score" className="mt-2 text-[11px] text-violet-400/60 hover:text-violet-400 flex items-center gap-1 transition-colors font-body">
                    Full breakdown <ArrowRight size={9} />
                  </a>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-white/20 text-xs font-body mb-3">Not calculated yet</p>
                  <a href="/score" className="text-xs bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-400 px-3 py-1.5 rounded-lg transition-colors font-body">
                    Calculate →
                  </a>
                </div>
              )}
            </div>

            {/* Upgrade if free */}
            {user?.tier !== 'premium' && (
              <motion.div whileHover={{ scale: 1.01 }}
                className="bg-gradient-to-br from-yellow-900/25 to-orange-900/15 border border-yellow-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Crown size={13} className="text-yellow-400" />
                  <span className="text-sm font-heading font-semibold text-yellow-400">Go Premium</span>
                </div>
                <p className="text-xs text-white/40 font-body mb-3">AI weekly check-ins, unlimited DSA, adaptive replanning.</p>
                <a href="/upgrade">
                  <motion.button whileTap={{ scale: 0.97 }}
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-heading font-bold text-xs h-8 rounded-xl hover:opacity-90 transition-opacity">
                    Upgrade for ₹99/month
                  </motion.button>
                </a>
              </motion.div>
            )}

            {/* Weekly check-in */}
            <CheckinPanel />
          </motion.div>
        </div>

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
    } catch { setResult('Backend unavailable — try again later.'); setStep('done') }
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
    <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 size={13} className="text-violet-400" />
        <span className="text-sm font-heading font-semibold text-white/70">Weekly Check-in</span>
      </div>
      {step === 'done' ? (
        <p className="text-xs text-emerald-400 font-body flex items-center gap-1.5"><CheckCircle2 size={11} /> {result}</p>
      ) : step === 'answering' ? (
        <div className="space-y-2.5">
          {questions.map((q, i) => (
            <div key={i}>
              <p className="text-[11px] text-white/50 font-body mb-1">{q}</p>
              <input value={answers[i]} onChange={e => { const n = [...answers]; n[i] = e.target.value; setAnswers(n) }}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 font-body"
                placeholder="Your answer..." />
            </div>
          ))}
          <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={loading || answers.every(a => !a.trim())}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs h-8 rounded-xl font-heading transition-colors">
            {loading ? 'Processing...' : 'Submit'}
          </motion.button>
        </div>
      ) : (
        <>
          <p className="text-xs text-white/35 font-body mb-3">AI reviews your week and replans your roadmap.</p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={start} disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/10 text-white/50 hover:text-white text-xs h-8 rounded-xl font-body transition-all duration-200">
            <Clock size={11} /> {loading ? 'Loading...' : 'Start check-in'}
          </motion.button>
        </>
      )}
    </div>
  )
}
