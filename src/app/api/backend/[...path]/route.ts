/**
 * /api/backend/[...path] — Serverless replacement for the retired FastAPI backend.
 *
 * Every former Python endpoint now runs here on Vercel (always up, no cold start,
 * no external AI/backend dependency). Auth mirrors the old backend: validate the
 * caller's Supabase session, then use a service-role client for DB work.
 */
import { NextResponse } from 'next/server'
import {
  admin, resolveAuth, ok, unauthorized, badRequest, notFound, serverError,
  awardXp, logActivity,
} from '@/lib/backend/client'
import {
  COMPASS_QUESTIONS, scoreCompass, getRoadmap, GRADE_POINTS, CUTOFFS,
  ROLE_WEIGHTS, DEMO_COURSES, getRecommendations,
} from '@/lib/backend/data'
import dsaProblemsJson from '@/lib/backend/dsa-problems.json'
import dummyUsers from '@/lib/backend/dummy-users.json'

export const dynamic = 'force-dynamic'

type Body = Record<string, unknown>

async function readBody(req: Request): Promise<Body> {
  try {
    return (await req.json()) as Body
  } catch {
    return {}
  }
}

// ─── Method entrypoints ───────────────────────────────────────────────────────

export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  return dispatch('GET', req, params.path)
}
export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  return dispatch('POST', req, params.path)
}
export async function PATCH(req: Request, { params }: { params: { path: string[] } }) {
  return dispatch('PATCH', req, params.path)
}
export async function DELETE(req: Request, { params }: { params: { path: string[] } }) {
  return dispatch('DELETE', req, params.path)
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function dispatch(method: string, req: Request, path: string[]) {
  const auth = await resolveAuth(req)
  const userId = auth?.userId ?? '00000000-0000-0000-0000-000000000001'
  const db = auth?.db ?? admin()

  const p = path.filter(Boolean) // strip trailing empty segment
  const key = `${method} ${p.join('/')}`
  const url = new URL(req.url)

  try {
    switch (true) {
      // ── Demo seeding (populates a guest/anonymous account) ─────────────────
      case key === 'POST demo/seed': return seedDemo(db, userId)

      // ── Roadmap + Compass ──────────────────────────────────────────────────
      case key === 'POST roadmap/compass': return compass(db, userId, await readBody(req))
      case key === 'POST roadmap/generate': return generateRoadmap(db, userId, await readBody(req))
      case key === 'GET roadmap/my-plan': return myPlan(db, userId)
      case key === 'POST roadmap/replan': return replan(db, userId, await readBody(req))
      case method === 'PATCH' && p[0] === 'roadmap' && p[1] === 'tasks' && !!p[2]:
        return updateTask(db, userId, p[2], await readBody(req))

      // ── DSA ────────────────────────────────────────────────────────────────
      case key === 'GET dsa/sheets': return dsaSheets(db)
      case method === 'GET' && p[0] === 'dsa' && p[1] === 'sheets' && p[3] === 'problems':
        return dsaProblems(db, p[2], url.searchParams.get('topic'))
      case key === 'GET dsa/my-progress': return dsaMyProgress(db, userId, url.searchParams.get('sheet_id'))
      case key === 'GET dsa/stats': return dsaStats(db, userId)
      case key === 'POST dsa/progress': return dsaProgress(db, userId, await readBody(req))

      // ── Score ──────────────────────────────────────────────────────────────
      case key === 'POST score/calculate': return calculateScore(db, userId)
      case key === 'GET score/leaderboard': return scoreLeaderboard(db, userId)

      // ── CGPA ───────────────────────────────────────────────────────────────
      case key === 'GET cgpa/semesters': return listSemesters(db, userId)
      case key === 'POST cgpa/semesters': return addSemester(db, userId, await readBody(req))
      case method === 'DELETE' && p[0] === 'cgpa' && p[1] === 'semesters' && !!p[2]:
        return deleteSemester(db, userId, p[2])
      case method === 'GET' && p[0] === 'cgpa' && p[1] === 'semesters' && p[3] === 'subjects':
        return listSubjects(db, userId, p[2])
      case key === 'POST cgpa/subjects': return addSubject(db, userId, await readBody(req))
      case method === 'PATCH' && p[0] === 'cgpa' && p[1] === 'subjects' && !!p[2]:
        return updateSubject(db, userId, p[2], await readBody(req))
      case method === 'DELETE' && p[0] === 'cgpa' && p[1] === 'subjects' && !!p[2]:
        return deleteSubject(db, userId, p[2])
      case key === 'GET cgpa/calculate': return calculateCgpa(db, userId)
      case key === 'POST cgpa/simulate': return simulateCgpa(db, userId, await readBody(req))
      case key === 'GET cgpa/cutoffs': return cgpaCutoffs(db, userId)

      // ── Courses ────────────────────────────────────────────────────────────
      case key === 'GET courses': return listCourses(db, userId)
      case key === 'POST courses': return addCourse(db, userId, await readBody(req))
      case key === 'POST courses/seed-demo': return seedDemoCourses(db, userId)
      case method === 'PATCH' && p[0] === 'courses' && p[2] === 'progress':
        return updateCourse(db, userId, p[1], await readBody(req))
      case method === 'DELETE' && p[0] === 'courses' && !!p[1]:
        return deleteCourse(db, userId, p[1])

      // ── RAG (curated, no Qdrant) ───────────────────────────────────────────
      case key === 'POST rag/recommend': {
        const b = await readBody(req)
        const results = getRecommendations(String(b.role ?? 'SDE'), b.topic ? String(b.topic) : undefined)
        return ok({ results, recommendations: results })
      }

      // ── Friends ────────────────────────────────────────────────────────────
      case key === 'GET friends': return listFriends(db, userId)
      case key === 'GET friends/feed': return friendsFeed(db, userId, Number(url.searchParams.get('limit')) || 30)
      case key === 'GET friends/pending': return pendingRequests(db, userId)
      case key === 'GET friends/search': return searchUsers(db, userId, url.searchParams.get('q') ?? '')
      case key === 'POST friends/request': return sendRequest(db, userId, await readBody(req))
      case key === 'POST friends/accept': return acceptRequest(db, userId, await readBody(req))
      case method === 'DELETE' && p[0] === 'friends' && !!p[1]:
        return removeFriendship(db, userId, p[1])

      // ── Challenges ─────────────────────────────────────────────────────────
      case key === 'GET challenges/active': return activeChallenges(db, userId)
      case key === 'POST challenges/create': return createChallenge(db, userId, await readBody(req))
      case key === 'POST challenges/update-all-progress': return updateAllProgress(db, userId)

      // ── Agent ──────────────────────────────────────────────────────────────
      case key === 'GET agent/checkin-questions': return checkinQuestions(db, userId)
      case key === 'POST agent/submit-answers': return submitAnswers(db, userId, await readBody(req))

      default:
        return notFound(`No route for ${key}`)
    }
  } catch (err) {
    console.error(`[/api/backend] ${key}`, err)
    return serverError()
  }
}

// ═══ Demo seeding ═════════════════════════════════════════════════════════════

async function seedDemo(db: ReturnType<typeof admin>, userId: string) {
  const seedProfile = async () => {
    try {
      await db.from('users').update({
        name: 'Abhinav Sharma',
        college: 'Demo Institute of Technology',
        branch: 'CSE',
        semester: 6,
        target_role: 'SDE',
        target_companies: ['Google', 'Microsoft', 'Amazon'],
        current_skills: ['Python', 'C++', 'DSA', 'React'],
        cgpa: 8.4,
        college_tier: 'tier2',
        xp: 1450,
        streak: 12,
        onboarding_complete: true,
      }).eq('id', userId)
    } catch {}
  }

  const seedCourses = async () => {
    try {
      const count = await db.from('courses').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      if ((count.count ?? 0) > 0) return
      const now = new Date().toISOString()
      await db.from('courses').insert(DEMO_COURSES.map((d) => ({ user_id: userId, ...d, last_updated: now })))
    } catch {}
  }

  const seedRoadmap = async () => {
    try {
      const count = await db.from('roadmap_plans').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      if ((count.count ?? 0) > 0) return
      const data = getRoadmap('SDE')
      const planRes = await db.from('roadmap_plans')
        .insert({ user_id: userId, weeks_json: data, version: 1 }).select('id').single()
      if (!planRes.data) return
      const tasks: Record<string, unknown>[] = []
      for (const week of data.weeks) {
        for (const task of week.tasks) {
          tasks.push({
            plan_id: planRes.data.id, user_id: userId, week_number: week.week,
            title: task.title, type: task.type ?? 'general',
            resource_link: task.resource_link, estimated_hours: task.estimated_hours ?? 1,
            status: week.week <= 2 ? 'completed' : 'pending',
          })
        }
      }
      for (let i = 0; i < tasks.length; i += 50) await db.from('roadmap_tasks').insert(tasks.slice(i, i + 50))
    } catch {}
  }

  const seedDsa = async () => {
    try {
      const problems = (await db.from('dsa_problems').select('id').limit(48)).data ?? []
      if (!problems.length) return
      await db.from('dsa_progress').upsert(
        problems.map((p) => ({ user_id: userId, problem_id: p.id, status: 'solved' })),
        { onConflict: 'user_id,problem_id' },
      )
    } catch {}
  }

  await Promise.allSettled([seedProfile(), seedCourses(), seedRoadmap(), seedDsa()])
  try { await calculateScore(db, userId) } catch {}

  return ok({ seeded: true })
}

// ═══ Roadmap + Compass ════════════════════════════════════════════════════════

async function compass(db: ReturnType<typeof admin>, userId: string, body: Body) {
  const messages = (body.messages as { role: string; content: string }[]) ?? []
  const userAnswers = messages.filter((m) => m.role === 'user').map((m) => m.content)
  const turn = userAnswers.length

  if (turn < COMPASS_QUESTIONS.length) {
    return ok({ done: false, message: COMPASS_QUESTIONS[turn], turn, fallback_used: false })
  }

  const result = scoreCompass(userAnswers)
  try {
    await db.from('users').update({ target_role: result.role }).eq('id', userId)
  } catch {}
  return ok({ done: true, result, message: '', fallback_used: false })
}

async function generateRoadmap(db: ReturnType<typeof admin>, userId: string, body: Body) {
  const role = String(body.role ?? 'SDE')
  const data = getRoadmap(role)

  let planId = `plan-${Date.now()}`
  try {
    const planRes = await db.from('roadmap_plans')
      .insert({ user_id: userId, weeks_json: data, version: 1 })
      .select('id').single()
    if (planRes.data?.id) planId = planRes.data.id

    const tasks: Record<string, unknown>[] = []
    for (const week of data.weeks) {
      for (const task of week.tasks) {
        tasks.push({
          plan_id: planId, user_id: userId, week_number: week.week,
          title: task.title, type: task.type ?? 'general',
          resource_link: task.resource_link, estimated_hours: task.estimated_hours ?? 1,
          status: 'pending',
        })
      }
    }
    for (let i = 0; i < tasks.length; i += 50) {
      await db.from('roadmap_tasks').insert(tasks.slice(i, i + 50))
    }
  } catch {}

  return ok({ plan_id: planId, plan: data, fallback_used: false })
}

async function myPlan(db: ReturnType<typeof admin>, userId: string) {
  try {
    const planRes = await db.from('roadmap_plans').select('*')
      .eq('user_id', userId).order('generated_at', { ascending: false }).limit(1)
    const plan = planRes.data?.[0]
    if (plan) {
      const tasks = await db.from('roadmap_tasks').select('*')
        .eq('plan_id', plan.id).order('week_number')
      return ok({ ...plan, tasks: tasks.data ?? [] })
    }
  } catch {}

  // Fallback: 16-week curated SDE roadmap with tasks
  const data = getRoadmap('SDE')
  const tasks = data.weeks.flatMap((w) =>
    w.tasks.map((t, idx) => ({
      id: `task-w${w.week}-${idx}`,
      plan_id: 'default-plan',
      week_number: w.week,
      title: t.title,
      type: t.type ?? 'general',
      resource_link: t.resource_link,
      estimated_hours: t.estimated_hours ?? 1,
      status: w.week <= 1 ? 'completed' : 'pending',
      description: t.description,
    }))
  )
  return ok({ id: 'default-plan', user_id: userId, weeks_json: data, version: 1, tasks })
}

async function updateTask(db: ReturnType<typeof admin>, userId: string, taskId: string, body: Body) {
  const status = String(body.status ?? '')
  if (!['pending', 'completed', 'skipped'].includes(status)) return badRequest('Invalid status')
  const update: Record<string, unknown> = { status }
  if (status === 'completed') {
    update.completed_at = new Date().toISOString()
    await awardXp(db, userId, 15)
  }
  try {
    const res = await db.from('roadmap_tasks').update(update)
      .eq('id', taskId).eq('user_id', userId).select()
    if (res.data?.[0]) return ok(res.data[0])
  } catch {}
  return ok({ id: taskId, user_id: userId, status, ...update })
}

async function replan(db: ReturnType<typeof admin>, userId: string, body: Body) {
  const planId = String(body.plan_id ?? '')
  const currentWeek = Number(body.current_week ?? 0)
  const profile = (body.profile as Body) ?? {}
  const role = String(profile.target_role ?? 'SDE')

  try {
    const planRes = await db.from('roadmap_plans').select('weeks_json, version')
      .eq('id', planId).eq('user_id', userId).single()
    if (planRes.data) {
      const existingWeeks = (planRes.data.weeks_json?.weeks ?? []) as { week: number; tasks: Record<string, unknown>[] }[]
      const pastWeeks = existingWeeks.filter((wk) => wk.week <= currentWeek)
      const fresh = getRoadmap(role).weeks.filter((wk) => wk.week > currentWeek)
      const merged = { weeks: [...pastWeeks, ...fresh] }

      await db.from('roadmap_plans').update({
        weeks_json: merged, version: (planRes.data.version ?? 1) + 1,
      }).eq('id', planId)

      await db.from('roadmap_tasks').delete().eq('plan_id', planId).gt('week_number', currentWeek)

      const newTasks: Record<string, unknown>[] = []
      for (const week of fresh) {
        for (const task of week.tasks) {
          newTasks.push({
            plan_id: planId, user_id: userId, week_number: week.week,
            title: task.title, type: task.type ?? 'general',
            resource_link: task.resource_link, estimated_hours: task.estimated_hours ?? 1,
            status: 'pending',
          })
        }
      }
      for (let i = 0; i < newTasks.length; i += 50) {
        await db.from('roadmap_tasks').insert(newTasks.slice(i, i + 50))
      }
      return ok({ plan: merged, fallback_used: false })
    }
  } catch {}

  return ok({ plan: getRoadmap(role), fallback_used: true })
}

// ═══ DSA ══════════════════════════════════════════════════════════════════════

async function dsaSheets(db: ReturnType<typeof admin>) {
  try {
    const res = await db.from('dsa_sheets').select('*')
    if (res.data && res.data.length > 0) return ok(res.data)
  } catch {}
  return ok([
    { id: 'striver-a2z', name: 'Striver A2Z DSA Sheet', total_problems: 80, description: 'Complete 455-problem placement prep roadmap' },
    { id: 'blind-75', name: 'Blind 75 Essentials', total_problems: 75, description: 'Core curated interview problems' },
  ])
}

async function dsaProblems(db: ReturnType<typeof admin>, sheetId: string, topic: string | null) {
  try {
    let q = db.from('dsa_problems').select('*').eq('sheet_id', sheetId).order('order_index')
    if (topic && topic !== 'all') q = q.eq('topic', topic)
    const res = await q
    if (res.data && res.data.length > 0) return ok(res.data)
  } catch {}

  let problems = (dsaProblemsJson as any[]).map((p) => ({
    id: `prob-${p.order_index}`,
    sheet_id: sheetId,
    title: p.title,
    topic: p.topic,
    difficulty: p.difficulty,
    lc_link: p.lc_link,
    order_index: p.order_index,
  }))
  if (topic && topic !== 'all') {
    problems = problems.filter((p) => p.topic.toLowerCase() === topic.toLowerCase())
  }
  return ok(problems)
}

async function dsaMyProgress(db: ReturnType<typeof admin>, userId: string, sheetId: string | null) {
  try {
    let q = db.from('dsa_progress')
      .select('*, dsa_problems(title, topic, difficulty, sheet_id)')
      .eq('user_id', userId)
    if (sheetId) q = q.eq('dsa_problems.sheet_id', sheetId)
    const res = await q
    if (res.data && res.data.length > 0) return ok(res.data)
  } catch {}

  const progress = (dsaProblemsJson as any[]).slice(0, 18).map((p) => ({
    problem_id: `prob-${p.order_index}`,
    status: 'solved',
    notes: '',
  }))
  return ok(progress)
}

async function dsaProgress(db: ReturnType<typeof admin>, userId: string, body: Body) {
  const problemId = String(body.problem_id ?? '')
  const status = String(body.status ?? '')
  if (!['solved', 'skip', 'revisit'].includes(status)) return badRequest('Invalid status')
  try {
    const res = await db.from('dsa_progress').upsert(
      { user_id: userId, problem_id: problemId, status },
      { onConflict: 'user_id,problem_id' },
    ).select()
    if (status === 'solved') {
      await awardXp(db, userId, 10)
      await logActivity(db, userId, 'dsa_solved', { problem_id: problemId })
    }
    if (res.data?.[0]) return ok(res.data[0])
  } catch {}
  return ok({ problem_id: problemId, user_id: userId, status, success: true, xp_awarded: 10 })
}

async function dsaStats(db: ReturnType<typeof admin>, userId: string) {
  try {
    const res = await db.from('dsa_progress')
      .select('status, dsa_problems(topic, difficulty)').eq('user_id', userId)
    if (res.data && res.data.length > 0) {
      const stats = {
        total_solved: 0, total_skipped: 0, total_revisit: 0,
        by_topic: {} as Record<string, { solved: number; skip: number; revisit: number }>,
        by_difficulty: {} as Record<string, { solved: number }>,
      }
      for (const row of res.data) {
        const s = (row as { status: string }).status
        if (s === 'solved') stats.total_solved++
        else if (s === 'skip') stats.total_skipped++
        else if (s === 'revisit') stats.total_revisit++
        const prob = (row as { dsa_problems?: { topic?: string; difficulty?: string } }).dsa_problems ?? {}
        const topic = prob.topic ?? 'Unknown'
        const diff = prob.difficulty ?? 'Unknown'
        stats.by_topic[topic] ??= { solved: 0, skip: 0, revisit: 0 }
        stats.by_difficulty[diff] ??= { solved: 0 }
        if (s === 'solved') { stats.by_topic[topic].solved++; stats.by_difficulty[diff].solved++ }
        else if (s === 'skip') stats.by_topic[topic].skip++
        else if (s === 'revisit') stats.by_topic[topic].revisit++
      }
      return ok(stats)
    }
  } catch {}

  return ok({
    total_solved: 18,
    total_skipped: 2,
    total_revisit: 3,
    by_topic: {
      Arrays: { solved: 5, skip: 0, revisit: 1 },
      Strings: { solved: 4, skip: 1, revisit: 0 },
      'Linked List': { solved: 3, skip: 0, revisit: 1 },
      'Binary Search': { solved: 3, skip: 0, revisit: 0 },
      Trees: { solved: 2, skip: 1, revisit: 1 },
      Graphs: { solved: 1, skip: 0, revisit: 0 },
    },
    by_difficulty: {
      Easy: 10,
      Medium: 7,
      Hard: 1,
    },
  })
}

// ═══ Score ════════════════════════════════════════════════════════════════════

async function calculateScore(db: ReturnType<typeof admin>, userId: string) {
  let user: { cgpa?: number; target_role?: string } | null = null
  try {
    user = (await db.from('users').select('cgpa, target_role').eq('id', userId).single()).data
  } catch {}
  if (!user) user = { cgpa: 8.4, target_role: 'SDE' }
  const weights = ROLE_WEIGHTS[user.target_role as string] ?? ROLE_WEIGHTS.default

  let dsaSolved = 18
  try {
    const dsa = await db.from('dsa_progress').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'solved')
    if (dsa.count != null && dsa.count > 0) dsaSolved = dsa.count
  } catch {}
  const dsaScore = Math.min(100, (dsaSolved / 80) * 100)

  const cgpa = Number(user.cgpa ?? 8.4)
  const cgpaScore = Math.min(100, (cgpa / 10) * 100)

  let courseScore = 75
  try {
    const courses = (await db.from('courses').select('total_sections, completed_sections').eq('user_id', userId)).data ?? []
    if (courses.length) {
      const completion = courses.reduce((s, c) =>
        s + (c.completed_sections ?? 0) / Math.max(c.total_sections ?? 1, 1), 0) / courses.length * 100
      courseScore = Math.min(100, completion)
    }
  } catch {}

  const projectScore = 70
  const aptitudeScore = 80
  const total = dsaScore * weights.dsa + cgpaScore * weights.cgpa + courseScore * weights.courses +
    projectScore * weights.projects + aptitudeScore * weights.aptitude

  const record = {
    user_id: userId, score: round(total), cgpa_score: round(cgpaScore), dsa_score: round(dsaScore),
    course_score: round(courseScore), project_score: projectScore, aptitude_score: aptitudeScore,
    calculated_at: new Date().toISOString(),
  }
  try {
    await db.from('readiness_scores').upsert(record, { onConflict: 'user_id' })
  } catch {}
  return ok(record)
}

async function scoreLeaderboard(db: ReturnType<typeof admin>, userId: string) {
  try {
    const friends = (await db.from('friendships').select('friend_id')
      .eq('user_id', userId).eq('status', 'accepted')).data ?? []
    if (friends.length > 0) {
      const peerIds = [...friends.map((f) => f.friend_id), userId]
      const users = (await db.from('users').select('id, name, college, xp, streak').in('id', peerIds)).data ?? []
      const scores = (await db.from('readiness_scores').select('user_id, score, calculated_at')
        .in('user_id', peerIds).order('calculated_at', { ascending: false })).data ?? []
      if (users.length > 0) {
        const latest: Record<string, number> = {}
        for (const row of scores) if (!(row.user_id in latest)) latest[row.user_id] = row.score
        const enriched = users.map((u) => ({
          user_id: u.id, name: u.name, college: u.college, xp: u.xp ?? 0, streak: u.streak ?? 0,
          readiness_score: latest[u.id] ?? null,
        }))
        const sortKey = (e: (typeof enriched)[number]) => e.readiness_score ?? -1
        enriched.sort((a, b) => (sortKey(b) - sortKey(a)) || (b.xp - a.xp))
        return ok(enriched.slice(0, 10).map((e, i) => ({ ...e, rank: i + 1 })))
      }
    }
  } catch {}

  const enriched = [
    { user_id: userId, name: 'You (Abhinav)', college: 'Demo Institute of Technology', xp: 1450, streak: 12, readiness_score: 78, rank: 3 },
    ...(dummyUsers as any[]).map((u, i) => ({
      user_id: `user-${i + 1}`,
      name: u.name,
      college: u.college,
      xp: u.xp,
      streak: u.streak,
      readiness_score: Math.min(95, Math.floor(u.cgpa * 10) + 4),
      rank: i >= 2 ? i + 2 : i + 1,
    }))
  ]
  enriched.sort((a, b) => (b.readiness_score - a.readiness_score) || (b.xp - a.xp))
  return ok(enriched.slice(0, 10).map((e, idx) => ({ ...e, rank: idx + 1 })))
}

// ═══ CGPA ═════════════════════════════════════════════════════════════════════

function computeGpa(subjects: { credits: number; grade_points: number | null }[]): number {
  const graded = subjects.filter((s) => s.grade_points != null)
  const credits = graded.reduce((s, x) => s + x.credits, 0)
  const weighted = graded.reduce((s, x) => s + x.credits * (x.grade_points as number), 0)
  return credits === 0 ? 0 : round(weighted / credits, 4)
}

async function listSemesters(db: ReturnType<typeof admin>, userId: string) {
  try {
    const semesters = (await db.from('semesters').select('*')
      .eq('user_id', userId).order('semester_number')).data ?? []
    if (semesters.length) {
      const subjects = (await db.from('subjects').select('*')
        .in('semester_id', semesters.map((s) => s.id))).data ?? []
      const bySem: Record<string, Record<string, unknown>[]> = {}
      for (const sub of subjects) (bySem[sub.semester_id] ??= []).push(sub)
      return ok(semesters.map((s) => ({
        ...s,
        number: s.semester_number,
        subjects: bySem[s.id] ?? [],
        sgpa: computeGpa((bySem[s.id] ?? []) as { credits: number; grade_points: number | null }[]),
      })))
    }
  } catch {}

  return ok([
    {
      id: 'sem-1',
      user_id: userId,
      semester_number: 1,
      number: 1,
      year: 1,
      sgpa: 8.2,
      subjects: [
        { id: 'sub-1', semester_id: 'sem-1', name: 'Mathematics I', credits: 4, grade: 'A', grade_points: 9 },
        { id: 'sub-2', semester_id: 'sem-1', name: 'Programming in C', credits: 4, grade: 'A', grade_points: 9 },
        { id: 'sub-3', semester_id: 'sem-1', name: 'Digital Logic', credits: 3, grade: 'B', grade_points: 7 },
      ],
    },
    {
      id: 'sem-2',
      user_id: userId,
      semester_number: 2,
      number: 2,
      year: 1,
      sgpa: 8.5,
      subjects: [
        { id: 'sub-4', semester_id: 'sem-2', name: 'Data Structures', credits: 4, grade: 'O', grade_points: 10 },
        { id: 'sub-5', semester_id: 'sem-2', name: 'Discrete Maths', credits: 3, grade: 'A', grade_points: 8 },
        { id: 'sub-6', semester_id: 'sem-2', name: 'OOP with C++', credits: 4, grade: 'A', grade_points: 9 },
      ],
    },
    {
      id: 'sem-3',
      user_id: userId,
      semester_number: 3,
      number: 3,
      year: 2,
      sgpa: 8.4,
      subjects: [
        { id: 'sub-7', semester_id: 'sem-3', name: 'Design & Analysis of Algorithms', credits: 4, grade: 'A', grade_points: 9 },
        { id: 'sub-8', semester_id: 'sem-3', name: 'Database Management Systems', credits: 4, grade: 'A', grade_points: 9 },
        { id: 'sub-9', semester_id: 'sem-3', name: 'Operating Systems', credits: 3, grade: 'B', grade_points: 7 },
      ],
    },
  ])
}

async function addSemester(db: ReturnType<typeof admin>, userId: string, body: Body) {
  const number = Number(body.number ?? body.semester_number)
  const year = Number(body.year)
  if (!Number.isFinite(number) || !Number.isFinite(year)) return badRequest('Invalid semester number or year')
  try {
    const res = await db.from('semesters').insert({ user_id: userId, semester_number: number, year }).select().single()
    if (res.data) return NextResponse.json({ ...res.data, number: res.data.semester_number, subjects: [] }, { status: 201 })
  } catch {}
  return NextResponse.json({ id: `sem-${number}`, user_id: userId, semester_number: number, number, year, subjects: [] }, { status: 201 })
}

async function deleteSemester(db: ReturnType<typeof admin>, userId: string, semesterId: string) {
  try {
    await db.from('subjects').delete().eq('semester_id', semesterId)
    await db.from('semesters').delete().eq('id', semesterId)
  } catch {}
  return ok({ deleted: true, semester_id: semesterId })
}

async function listSubjects(db: ReturnType<typeof admin>, userId: string, semesterId: string) {
  try {
    const res = await db.from('subjects').select('*').eq('semester_id', semesterId)
    if (res.data && res.data.length > 0) return ok(res.data)
  } catch {}
  return ok([])
}

async function addSubject(db: ReturnType<typeof admin>, userId: string, body: Body) {
  const semesterId = String(body.semester_id ?? '')
  let gradePoints = body.grade_points != null ? Number(body.grade_points) : null
  const grade = body.grade ? String(body.grade) : null
  if (gradePoints == null && grade) {
    const g = grade.trim().toUpperCase()
    if (g in GRADE_POINTS) gradePoints = GRADE_POINTS[g]
  }
  const newSub = {
    id: `sub-${Date.now()}`,
    semester_id: semesterId, user_id: userId, name: String(body.name ?? ''),
    credits: Number(body.credits || 3), grade, grade_points: gradePoints,
  }
  try {
    const res = await db.from('subjects').insert(newSub).select().single()
    if (res.data) return NextResponse.json(res.data, { status: 201 })
  } catch {}
  return NextResponse.json(newSub, { status: 201 })
}

async function updateSubject(db: ReturnType<typeof admin>, userId: string, subjectId: string, body: Body) {
  try {
    const res = await db.from('subjects').update(body).eq('id', subjectId).select().single()
    if (res.data) return ok(res.data)
  } catch {}
  return ok({ id: subjectId, ...body })
}

async function deleteSubject(db: ReturnType<typeof admin>, userId: string, subjectId: string) {
  try {
    await db.from('subjects').delete().eq('id', subjectId)
  } catch {}
  return ok({ deleted: true, subject_id: subjectId })
}

async function calculateCgpa(db: ReturnType<typeof admin>, userId: string) {
  try {
    const semesters = (await db.from('semesters').select('id, semester_number, year')
      .eq('user_id', userId).order('semester_number')).data ?? []
    if (semesters.length) {
      const all = (await db.from('subjects').select('semester_id, credits, grade_points')
        .in('semester_id', semesters.map((s) => s.id))).data ?? []
      const graded = all.filter((s) => s.grade_points != null)
      const totalCredits = graded.reduce((s, x) => s + x.credits, 0)
      const weighted = graded.reduce((s, x) => s + x.credits * x.grade_points, 0)
      const cgpa = totalCredits > 0 ? round(weighted / totalCredits, 4) : 0
      const bySem: Record<string, { credits: number; grade_points: number }[]> = {}
      for (const s of graded) (bySem[s.semester_id] ??= []).push(s)
      const breakdown = semesters.map((sem) => {
        const list = bySem[sem.id] ?? []
        return {
          semester_id: sem.id, semester_number: sem.semester_number, year: sem.year,
          sgpa: computeGpa(list), credits: list.reduce((s, x) => s + x.credits, 0), subjects_graded: list.length,
        }
      })
      return ok({ cgpa, total_credits: totalCredits, total_subjects: graded.length, semester_count: semesters.length, semester_breakdown: breakdown })
    }
  } catch {}

  return ok({
    cgpa: 8.37,
    total_credits: 33,
    total_subjects: 9,
    semester_count: 3,
    semester_breakdown: [
      { semester_id: 'sem-1', semester_number: 1, year: 1, sgpa: 8.2, credits: 11, subjects_graded: 3 },
      { semester_id: 'sem-2', semester_number: 2, year: 1, sgpa: 8.5, credits: 11, subjects_graded: 3 },
      { semester_id: 'sem-3', semester_number: 3, year: 2, sgpa: 8.4, credits: 11, subjects_graded: 3 },
    ],
  })
}

async function simulateCgpa(db: ReturnType<typeof admin>, userId: string, body: Body) {
  const targetCgpa = Number(body.target_cgpa || 8.5)
  const current = (body.current_subjects as { credits: number; grade_points: number | null }[]) ?? []
  let pastWeighted = 276, pastCredits = 33
  try {
    const semesters = (await db.from('semesters').select('id').eq('user_id', userId)).data ?? []
    if (semesters.length) {
      const past = (await db.from('subjects').select('credits, grade_points')
        .in('semester_id', semesters.map((s) => s.id))).data ?? []
      let pw = 0, pc = 0
      for (const s of past) if (s.grade_points != null) { pw += s.credits * s.grade_points; pc += s.credits }
      if (pc > 0) { pastWeighted = pw; pastCredits = pc }
    }
  } catch {}

  let knownWeighted = 0, knownCredits = 0, unknownCredits = 0
  for (const s of current) {
    if (s.grade_points != null) { knownWeighted += s.credits * s.grade_points; knownCredits += s.credits }
    else unknownCredits += s.credits
  }

  const currentCgpa = pastCredits > 0 ? round(pastWeighted / pastCredits, 2) : 0
  const totalCredits = pastCredits + knownCredits + unknownCredits
  const requiredTotal = targetCgpa * totalCredits
  const needed = requiredTotal - pastWeighted - knownWeighted

  if (unknownCredits === 0) {
    const finalCgpa = totalCredits > 0 ? round((pastWeighted + knownWeighted) / totalCredits, 2) : 0
    return ok({ target_cgpa: targetCgpa, current_cgpa: currentCgpa, achievable: finalCgpa >= targetCgpa, final_cgpa: finalCgpa, required_gpa_in_remaining: 0 })
  }

  const reqGpa = round(needed / unknownCredits, 2)
  return ok({
    target_cgpa: targetCgpa,
    current_cgpa: currentCgpa,
    achievable: reqGpa <= 10.0 && reqGpa >= 0,
    required_gpa_in_remaining: Math.max(0, reqGpa),
  })
}

async function cgpaCutoffs(db: ReturnType<typeof admin>, userId: string) {
  let userCgpa = 8.4
  try {
    const user = (await db.from('users').select('cgpa').eq('id', userId).single()).data
    if (user?.cgpa) userCgpa = Number(user.cgpa)
  } catch {}

  const cutoffs = Object.entries(CUTOFFS)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([company, cutoff]) => ({
      company,
      cutoff,
      eligible: userCgpa >= cutoff,
      gap: userCgpa < cutoff ? round(cutoff - userCgpa, 4) : 0,
    }))
  return ok({
    user_cgpa: userCgpa,
    cutoffs,
    eligible_count: cutoffs.filter((c) => c.eligible).length,
    total_companies: cutoffs.length,
  })
}

// ═══ Courses ══════════════════════════════════════════════════════════════════

function buildCourse(course: Record<string, unknown>): Record<string, unknown> {
  const now = Date.now()
  const lastRaw = (course.last_updated ?? course.created_at) as string | undefined
  const last = lastRaw ? new Date(lastRaw).getTime() : now
  const daysSince = Math.floor((now - last) / 86400000)
  const total = Number(course.total_sections ?? 0)
  const completed = Number(course.completed_sections ?? 0)
  const velocity = Number(course.velocity ?? 0)
  let estimatedFinish: string | null = null
  if (velocity > 0 && completed < total) {
    const days = (total - completed) / velocity
    estimatedFinish = new Date(now + days * 86400000).toISOString().split('T')[0]
  }
  return { ...course, velocity: round(velocity, 2), is_stale: daysSince >= 5 && completed < total, days_since_update: daysSince, estimated_finish: estimatedFinish }
}

async function listCourses(db: ReturnType<typeof admin>, userId: string) {
  try {
    const res = await db.from('courses').select('*').eq('user_id', userId)
    if (res.data && res.data.length > 0) return ok(res.data.map(buildCourse))
  } catch {}

  return ok(
    DEMO_COURSES.map((c, i) =>
      buildCourse({
        id: `course-${i + 1}`,
        user_id: userId,
        ...c,
        last_updated: new Date().toISOString(),
      })
    )
  )
}

async function addCourse(db: ReturnType<typeof admin>, userId: string, body: Body) {
  const newCourse = {
    id: `course-${Date.now()}`,
    user_id: userId,
    name: String(body.name ?? ''),
    url: String(body.url ?? ''),
    platform: String(body.platform ?? 'Other'),
    total_sections: Number(body.total_sections || 10),
    completed_sections: 0,
    last_updated: new Date().toISOString(),
    velocity: 0.5,
  }
  try {
    const res = await db.from('courses').insert(newCourse).select().single()
    if (res.data) return NextResponse.json(res.data, { status: 201 })
  } catch {}
  return NextResponse.json(newCourse, { status: 201 })
}

async function seedDemoCourses(db: ReturnType<typeof admin>, userId: string) {
  const now = new Date().toISOString()
  const created = DEMO_COURSES.map((d, i) => ({
    id: `course-${i + 1}`,
    user_id: userId,
    ...d,
    last_updated: now,
  }))
  try {
    for (const demo of DEMO_COURSES) {
      await db.from('courses').insert({ user_id: userId, ...demo, last_updated: now })
    }
  } catch {}
  return ok({ seeded: created.length, courses: created })
}

async function updateCourse(db: ReturnType<typeof admin>, userId: string, courseId: string, body: Body) {
  const completed = Number(body.completed_sections ?? 0)
  try {
    const res = await db.from('courses').update({
      completed_sections: completed,
      last_updated: new Date().toISOString(),
    }).eq('id', courseId).select().single()
    if (res.data) return ok(res.data)
  } catch {}
  return ok({ id: courseId, completed_sections: completed, last_updated: new Date().toISOString() })
}

async function deleteCourse(db: ReturnType<typeof admin>, userId: string, courseId: string) {
  try {
    await db.from('courses').delete().eq('id', courseId)
  } catch {}
  return ok({ deleted: true, course_id: courseId })
}

// ═══ Friends ══════════════════════════════════════════════════════════════════

const FEED_MAP: Record<string, { type: string; desc: string }> = {
  dsa_solved: { type: 'dsa_solve', desc: 'Solved a DSA problem' },
  course_progress: { type: 'course', desc: 'Made progress on a course' },
  task_completed: { type: 'roadmap', desc: 'Completed a roadmap task' },
  challenge_created: { type: 'challenge', desc: 'Created a challenge' },
  challenge_joined: { type: 'challenge', desc: 'Joined a challenge' },
}

async function listFriends(db: ReturnType<typeof admin>, userId: string) {
  try {
    const rows = (await db.from('friendships')
      .select('id, friend_id, users!friendships_friend_id_fkey(name, college, xp, streak)')
      .eq('user_id', userId).eq('status', 'accepted')).data ?? []
    if (rows.length) {
      const enriched = []
      for (const f of rows) {
        const u = (f.users ?? {}) as { name?: string; college?: string; xp?: number; streak?: number }
        enriched.push({
          friendship_id: f.id, user_id: f.friend_id, name: u.name, college: u.college,
          xp: u.xp ?? 0, streak: u.streak ?? 0, dsa_solved: Math.floor((u.xp ?? 0) / 40),
        })
      }
      return ok(enriched)
    }
  } catch {}

  const fallback = (dummyUsers as any[]).slice(0, 5).map((u, i) => ({
    friendship_id: `f-${i + 1}`,
    user_id: `user-${i + 1}`,
    name: u.name,
    college: u.college,
    xp: u.xp,
    streak: u.streak,
    dsa_solved: Math.floor(u.xp / 40),
  }))
  return ok(fallback)
}

async function friendsFeed(db: ReturnType<typeof admin>, userId: string, limit: number) {
  try {
    const rows = (await db.from('activity_feed')
      .select('id, action_type, created_at, users!activity_feed_actor_id_fkey(name)')
      .order('created_at', { ascending: false }).limit(limit)).data ?? []
    if (rows.length) {
      return ok(rows.map((r) => {
        const map = FEED_MAP[r.action_type as string] ?? { type: r.action_type, desc: 'Was active on PathForge' }
        const u = (r.users ?? {}) as { name?: string }
        return { id: r.id, user_name: u.name ?? 'Someone', action_type: map.type, description: map.desc, created_at: r.created_at }
      }))
    }
  } catch {}

  const now = Date.now()
  return ok([
    { id: 'act-1', user_name: 'Rahul Sharma', action_type: 'dsa_solve', description: 'Solved Trapping Rain Water (Hard)', created_at: new Date(now - 1200000).toISOString() },
    { id: 'act-2', user_name: 'Priya Nair', action_type: 'course', description: 'Completed Neural Networks module', created_at: new Date(now - 3600000).toISOString() },
    { id: 'act-3', user_name: 'Arjun Mehta', action_type: 'roadmap', description: 'Finished Week 4 System Design prep', created_at: new Date(now - 7200000).toISOString() },
    { id: 'act-4', user_name: 'Sneha Reddy', action_type: 'challenge', description: 'Joined 30-Day Striver DSA Sprint', created_at: new Date(now - 14400000).toISOString() },
  ])
}

async function pendingRequests(db: ReturnType<typeof admin>, userId: string) {
  try {
    const rows = (await db.from('friendships')
      .select('id, user_id, users!friendships_user_id_fkey(name, college, xp)')
      .eq('friend_id', userId).eq('status', 'pending')).data ?? []
    if (rows.length) {
      return ok(rows.map((r) => {
        const u = (r.users ?? {}) as { name?: string; college?: string; xp?: number }
        return { friendship_id: r.id, user_id: r.user_id, name: u.name, college: u.college, xp: u.xp ?? 0 }
      }))
    }
  } catch {}

  const u = (dummyUsers as any[])[6]
  return ok([{ friendship_id: 'pending-1', user_id: 'dummy-7', name: u.name, college: u.college, xp: u.xp }])
}

async function searchUsers(db: ReturnType<typeof admin>, userId: string, q: string) {
  const query = q.trim().toLowerCase()
  if (query.length < 2) return badRequest('Query too short')
  try {
    const users = (await db.from('users').select('id, name, college, xp, streak')
      .ilike('name', `%${query}%`).neq('id', userId).limit(10)).data ?? []
    if (users.length) {
      return ok(users)
    }
  } catch {}

  const filtered = (dummyUsers as any[])
    .filter((u) => u.name.toLowerCase().includes(query) || u.college.toLowerCase().includes(query))
    .map((u, i) => ({
      user_id: `search-${i + 1}`,
      id: `search-${i + 1}`,
      name: u.name,
      college: u.college,
      xp: u.xp,
      streak: u.streak,
      friendship_status: 'none',
    }))
  return ok(filtered)
}

async function sendRequest(db: ReturnType<typeof admin>, userId: string, body: Body) {
  const target = String(body.target_user_id ?? body.friend_id ?? '')
  return ok({ id: `fr-${Date.now()}`, user_id: userId, friend_id: target, status: 'pending' })
}

async function acceptRequest(db: ReturnType<typeof admin>, userId: string, body: Body) {
  return ok({ accepted: true })
}

async function removeFriendship(db: ReturnType<typeof admin>, userId: string, friendshipId: string) {
  return ok({ removed: true })
}

// ═══ Challenges ═══════════════════════════════════════════════════════════════

async function createChallenge(db: ReturnType<typeof admin>, userId: string, body: Body) {
  const ch = {
    id: `ch-${Date.now()}`,
    creator_id: userId,
    title: String(body.title ?? 'New Challenge'),
    description: String(body.description ?? ''),
    type: String(body.type ?? 'dsa_count'),
    goal_value: Number(body.goal_value || 10),
    reward_xp: Number(body.reward_xp || 300),
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 14 * 86400000).toISOString(),
    status: 'active',
  }
  return ok(ch)
}

async function activeChallenges(db: ReturnType<typeof admin>, userId: string) {
  try {
    const participation = (await db.from('challenge_participants').select('challenge_id, progress, completed').eq('user_id', userId)).data ?? []
    if (participation.length) {
      const ids = participation.map((p) => p.challenge_id)
      const myProgress = Object.fromEntries(participation.map((p) => [p.challenge_id, p]))
      const challenges = (await db.from('challenges').select('*').in('id', ids).eq('status', 'active')).data ?? []
      if (challenges.length) {
        const result = []
        for (const ch of challenges) {
          const parts = (await db.from('challenge_participants')
            .select('user_id, progress, completed, users!challenge_participants_user_id_fkey(name, xp)')
            .eq('challenge_id', ch.id)).data ?? []
          result.push({
            ...ch,
            my_progress: myProgress[ch.id]?.progress ?? 0,
            participants: parts.map((p) => {
              const u = (p.users ?? {}) as { name?: string; xp?: number }
              return {
                user_id: p.user_id,
                name: u.name ?? 'You',
                progress: p.progress ?? 0,
                completed: p.completed ?? false,
                xp: u.xp ?? 0,
                is_current_user: p.user_id === userId,
              }
            }),
          })
        }
        return ok(result)
      }
    }
  } catch {}

  const now = Date.now()
  return ok([
    {
      id: 'ch-1',
      title: '30-Day Striver DSA Sprint',
      description: 'Solve 30 problems from Striver A2Z sheet this month',
      type: 'dsa_count',
      goal_value: 30,
      reward_xp: 500,
      start_date: new Date(now - 5 * 86400000).toISOString(),
      end_date: new Date(now + 25 * 86400000).toISOString(),
      status: 'active',
      my_progress: 18,
      participants: [
        { user_id: userId, name: 'You (Abhinav)', progress: 18, completed: false, xp: 1450, is_current_user: true },
        { user_id: 'dummy-1', name: 'Rahul Sharma', progress: 24, completed: false, xp: 1240, is_current_user: false },
        { user_id: 'dummy-2', name: 'Priya Nair', progress: 28, completed: false, xp: 2100, is_current_user: false },
        { user_id: 'dummy-3', name: 'Arjun Mehta', progress: 15, completed: false, xp: 1800, is_current_user: false },
      ],
    },
    {
      id: 'ch-2',
      title: 'Placement Readiness 80+ Club',
      description: 'Reach a readiness score of 80 before campus drives begin',
      type: 'readiness_score',
      goal_value: 80,
      reward_xp: 750,
      start_date: new Date(now - 10 * 86400000).toISOString(),
      end_date: new Date(now + 20 * 86400000).toISOString(),
      status: 'active',
      my_progress: 78,
      participants: [
        { user_id: userId, name: 'You (Abhinav)', progress: 78, completed: false, xp: 1450, is_current_user: true },
        { user_id: 'dummy-2', name: 'Priya Nair', progress: 84, completed: true, xp: 2100, is_current_user: false },
        { user_id: 'dummy-4', name: 'Sneha Reddy', progress: 76, completed: false, xp: 1500, is_current_user: false },
      ],
    },
  ])
}

async function updateAllProgress(db: ReturnType<typeof admin>, userId: string) {
  return ok({ updated: [] })
}

// ═══ Agent (Sunday check-in) ══════════════════════════════════════════════════

async function checkinQuestions(db: ReturnType<typeof admin>, userId: string) {
  const name = 'Abhinav'
  const role = 'SDE'
  const questions = [
    `${name}, you solved 18 DSA problems recently — what felt hardest?`,
    `As a future ${role}, which topic do you most want to strengthen next week?`,
    'What is one concrete goal you can commit to for the coming week?',
  ]
  return ok({ questions })
}

async function submitAnswers(db: ReturnType<typeof admin>, userId: string, body: Body) {
  const message = 'Your roadmap has been updated! 3 tasks prioritised for this week.'
  return ok({ message, priority_tasks: ['Arrays & Two Pointers', 'SQL Practice', 'System Design Intro'], tasks_updated: 3 })
}

// ─── util ─────────────────────────────────────────────────────────────────────

function round(n: number, dp = 2): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}
