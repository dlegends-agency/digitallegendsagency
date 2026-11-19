import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import QuickLog from './QuickLog'
import { TimerButton, useTimer, useElapsed, fmtClock } from './timer'
import { card, fmtDate, isOverdue, todayStr, dayKey, Bar, Avatar, ErrorNote, Icon, PRIORITY } from './ui'
import { useCategories, COLORS } from './data'
import { fetchEntries, byDay, today, addDays, mondayOf, parse, fmtMin } from './time'

const lbl = 'text-xs font-semibold uppercase tracking-[0.16em] text-snow/45'
const ease = [0.22, 1, 0.36, 1]
const REFRESH_MS = 60000

/* ---------------- small building blocks ---------------- */
function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf, start
    const tick = (t) => {
      start ??= t
      const p = Math.min(1, (t - start) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}
function Num({ value, format = String, className = '' }) {
  return <span className={`tabular-nums ${className}`}>{format(useCountUp(value))}</span>
}

function Spark({ data, color = '#2f7bff' }) {
  const id = useId()
  const w = 160, h = 44
  const max = Math.max(1, ...data)
  const step = w / Math.max(1, data.length - 1)
  const pts = data.map((v, i) => [i * step, h - 5 - (v / max) * (h - 12)])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-11 w-full" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <motion.path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.3 }} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease }} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/* Change versus the previous period. goodWhenUp=false flips the colours (for overdue work, for example). */
function Delta({ cur, prev, goodWhenUp = true, suffix = 'vs previous' }) {
  if (!prev && !cur) return <span className="text-xs text-snow/40">No change</span>
  if (!prev) return <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">New</span>
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return <span className="text-xs text-snow/45">Same {suffix}</span>
  const up = pct > 0
  const good = up === goodWhenUp
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`rounded-full px-2 py-0.5 font-semibold ${good ? 'bg-emerald-400/15 text-emerald-300' : 'bg-pink/15 text-pink'}`}>{up ? '▲' : '▼'} {Math.abs(pct)}%</span>
      <span className="text-snow/40">{suffix}</span>
    </span>
  )
}

function Skel({ className = '' }) { return <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} /> }

function Panel({ title, sub, action, children, className = '', id }) {
  return (
    <motion.section id={id} variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }} className={`${card} scroll-mt-24 p-6 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-lg font-bold tracking-[-0.03em]">{title}</h2>{sub && <p className="mt-0.5 text-xs text-snow/45">{sub}</p>}</div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </motion.section>
  )
}

const ago = (iso) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
const range14 = () => Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13))

/* ---------------- hero ---------------- */
function Hero({ user, m, navigate }) {
  const timer = useTimer()
  const [now, setNow] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id) }, [])
  const h = now.getHours()
  const greet = h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const raw = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0]
  const first = raw.split(' ')[0].charAt(0).toUpperCase() + raw.split(' ')[0].slice(1)
  const actions = [
    ['New task', 'plus', () => navigate('#/projects?new=task')], ['New project', 'folder', () => navigate('#/projects?new=project')],
    ['Write post', 'pen', () => navigate('#/blog/new')], ['Add resource', 'book', () => navigate('#/resources/new')],
    ['Log time', 'clock', () => document.getElementById('log-time')?.scrollIntoView({ behavior: 'smooth', block: 'center' })],
  ]
  const Strong = ({ children, tone }) => <strong className={`font-semibold ${tone || 'text-snow'}`}>{children}</strong>

  return (
    <motion.section variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
      className={`${card} relative overflow-hidden p-6 md:p-9`}>
      <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-violet/25 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 h-64 w-64 rounded-full bg-pink/15 blur-[90px]" />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-snow/50">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
            {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.045em] md:text-6xl">{greet}, {first}.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-snow/65">
            {!m ? 'Loading your day...' : (
              <>
                {m.attention ? <>You have <Strong tone={m.overdue ? 'text-pink' : undefined}>{m.attention} task{m.attention === 1 ? '' : 's'}</Strong> that need attention{m.overdue ? `, ${m.overdue} overdue` : ' today'}</> : <>Nothing urgent on your list</>}
                {m.newLeads ? <>, <Strong>{m.newLeads} new enquir{m.newLeads === 1 ? 'y' : 'ies'}</Strong> waiting</> : ''}
                {m.today ? <> and <Strong>{fmtMin(m.today)}</Strong> logged today</> : ''}.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
          {actions.map(([l, icon, fn]) => (
            <button key={l} onClick={fn} className="glass group flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-white/10">
              <Icon name={icon} className="h-4 w-4 text-snow/70 transition-colors group-hover:text-pink" />{l}
            </button>
          ))}
        </div>
      </div>
      {timer?.timer && <TrackingStrip timer={timer} />}
    </motion.section>
  )
}
function TrackingStrip({ timer }) {
  const ms = useElapsed(timer.timer.started_at)
  return (
    <div className="relative mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-pink/40 bg-pink/10 px-5 py-3">
      <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pink" /></span>
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-pink">Tracking now</span>
      <span className="min-w-0 flex-1 truncate font-semibold">{timer.timer.task_title}</span>
      <span className="font-mono text-lg font-semibold tabular-nums">{fmtClock(ms)}</span>
      <button onClick={timer.stop} disabled={timer.busy} className="pill-white flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"><Icon name="stop" className="h-3.5 w-3.5" />Stop</button>
    </div>
  )
}

/* ---------------- KPI card ---------------- */
function Kpi({ title, value, format, delta, spark, color, foot, goodWhenUp, onClick, loading }) {
  return (
    <motion.button variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }} whileHover={{ y: -3 }} onClick={onClick}
      className={`${card} group relative overflow-hidden p-5 text-left transition-colors hover:border-white/30`}>
      <p className={lbl}>{title}</p>
      {loading ? <Skel className="mt-3 h-10 w-24" /> : <p className="mt-2 text-4xl font-bold tracking-[-0.04em]"><Num value={value} format={format} /></p>}
      <div className="mt-2 min-h-5">{loading ? <Skel className="h-4 w-32" /> : delta ? <Delta {...delta} goodWhenUp={goodWhenUp} /> : <span className="text-xs text-snow/45">{foot}</span>}</div>
      <div className="mt-3 -mb-1 opacity-90">{loading ? <Skel className="h-11" /> : <Spark data={spark} color={color} />}</div>
      {!loading && foot && delta && <p className="mt-2 text-xs text-snow/45">{foot}</p>}
    </motion.button>
  )
}

/* ---------------- page ---------------- */
export default function Today({ user, navigate, isSuper }) {
  const cats = useCategories()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(null)
  const [spin, setSpin] = useState(false)
  const [gone, setGone] = useState({})

  const load = useCallback(async () => {
    setSpin(true)
    const since = new Date(Date.now() - 60 * 864e5).toISOString()
    const [l, t, p, a, e, act] = await Promise.all([
      supabase.from('leads').select('id,name,email,message,status,created_at').order('created_at', { ascending: false }).limit(300),
      supabase.from('tasks').select('*, projects(name)').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('analytics_events').select('session_id,type,label,created_at').gte('created_at', since).limit(20000),
      fetchEntries(addDays(today(), -14)),
      isSuper ? supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    ])
    const err = l.error || t.error || p.error
    setError(err ? err.message : '')
    setData({ leads: l.data || [], tasks: t.data || [], projects: p.data || [], events: a.data || [], entries: e.data || [], activity: act.data || [] })
    setUpdated(new Date()); setSpin(false)
  }, [isSuper])

  useEffect(() => {
    load()
    const id = setInterval(load, REFRESH_MS)
    const vis = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('dl:time-changed', load)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); window.removeEventListener('dl:time-changed', load) }
  }, [load])

  const m = useMemo(() => {
    if (!data) return null
    const days = range14()
    const sessionsOn = (type) => {
      const per = Object.fromEntries(days.map((d) => [d, new Set()]))
      data.events.forEach((e) => { if (e.type === type) { const k = dayKey(e.created_at); if (k in per) per[k].add(e.session_id) } })
      return days.map((d) => per[d].size)
    }
    const visits = sessionsOn('pageview')
    const leadsPer = Object.fromEntries(days.map((d) => [d, 0]))
    data.leads.forEach((l) => { const k = dayKey(l.created_at); if (k in leadsPer) leadsPer[k]++ })
    const enquiries = days.map((d) => leadsPer[d])
    const sum = (arr, a, b) => arr.slice(a, b).reduce((x, y) => x + y, 0)

    const open = data.tasks.filter((t) => t.status !== 'done')
    const mine = open.filter((t) => t.assignee_id === user.id)
    const td = todayStr()
    const overdueList = mine.filter(isOverdue).sort((a, b) => a.due_date.localeCompare(b.due_date))
    const dueTodayList = mine.filter((t) => t.due_date === td)
    const inProgressList = mine.filter((t) => t.status === 'in_progress' && !isOverdue(t) && t.due_date !== td)
    const nextWeek = addDays(td, 7)
    const upcomingList = open.filter((t) => t.due_date && t.due_date > td && t.due_date <= nextWeek)
    const doneMine = data.tasks.filter((t) => t.status === 'done' && t.assignee_id === user.id && t.completed_at)
    const donePer = Object.fromEntries(days.map((d) => [d, 0]))
    doneMine.forEach((t) => { const k = dayKey(t.completed_at); if (k in donePer) donePer[k]++ })
    const done = days.map((d) => donePer[d])

    // time: this week so far vs the same stretch of last week
    const all = byDay(data.entries)
    const mon = mondayOf(today())
    const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(mon, i); return { d, v: all.get(d) } })
    const elapsed = Math.floor((parse(today()) - parse(mon)) / 864e5) + 1
    const weekTotal = week.reduce((s, x) => s + (x.v?.total || 0), 0)
    const lastWeekSame = Array.from({ length: elapsed }, (_, i) => all.get(addDays(mon, i - 7))?.total || 0).reduce((a, b) => a + b, 0)
    const timeSpark = days.map((d) => all.get(d)?.total || 0)

    // website funnel (30 days)
    const cut = new Date(Date.now() - 30 * 864e5).toISOString()
    const uniq = (pred) => new Set(data.events.filter((e) => e.created_at >= cut && pred(e)).map((e) => e.session_id)).size
    const funnel = [
      ['Visited the site', uniq((e) => e.type === 'pageview')],
      ['Reached the contact section', uniq((e) => e.type === 'section' && e.label === 'contact')],
      ['Clicked Start a project', uniq((e) => e.type === 'cta_click')],
      ['Sent a message', uniq((e) => e.type === 'form_submit')],
    ]

    return {
      newLeads: data.leads.filter((l) => l.status === 'new').length,
      overdueList, dueTodayList, inProgressList, upcomingList, attention: overdueList.length + dueTodayList.length, overdue: overdueList.length,
      myOpen: mine.length, today: all.get(today())?.total || 0, week, weekTotal, lastWeekSame, all,
      visits, visits7: sum(visits, 7, 14), visitsPrev: sum(visits, 0, 7),
      enquiries, enq7: sum(enquiries, 7, 14), enqPrev: sum(enquiries, 0, 7),
      done, done7: sum(done, 7, 14), donePrev: sum(done, 0, 7), timeSpark, funnel,
    }
  }, [data, user.id])

  async function complete(t) {
    setGone((g) => ({ ...g, [t.id]: true }))
    setTimeout(() => setData((d) => d && ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, status: 'done', completed_at: new Date().toISOString() } : x)) })), 450)
    const { error } = await supabase.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', t.id)
    if (error) { setError(error.message); setGone((g) => ({ ...g, [t.id]: false })) }
  }
  async function markContacted(l) {
    setData((d) => ({ ...d, leads: d.leads.map((x) => (x.id === l.id ? { ...x, status: 'contacted' } : x)) }))
    const { error } = await supabase.from('leads').update({ status: 'contacted' }).eq('id', l.id)
    if (error) { setError(error.message); load() }
  }

  const loading = !m
  const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
  const maxDay = m ? Math.max(1, ...m.week.map((x) => x.v?.total || 0)) : 1
  const colorOf = (name) => COLORS[cats.categories.find((c) => c.name === name)?.color] || 'bg-snow/50'

  const groups = m ? [
    ['Overdue', m.overdueList, 'text-pink'], ['Due today', m.dueTodayList, 'text-amber-300'], ['In progress', m.inProgressList, 'text-violet'],
  ].filter(([, list]) => list.length) : []

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-12">
      <div className="xl:col-span-12"><Hero user={user} m={m} navigate={navigate} /></div>
      {error && <div className="xl:col-span-12"><ErrorNote error={error} /></div>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:col-span-12 xl:grid-cols-4">
        <Kpi title="Visits, 7 days" loading={loading} value={m?.visits7 || 0} spark={m?.visits || [0, 0]} color="#2f7bff" delta={m && { cur: m.visits7, prev: m.visitsPrev }} foot="Website sessions" onClick={() => navigate('#/analytics')} />
        <Kpi title="Enquiries, 7 days" loading={loading} value={m?.enq7 || 0} spark={m?.enquiries || [0, 0]} color="#f03aae" delta={m && { cur: m.enq7, prev: m.enqPrev }} foot={m ? `${m.newLeads} still new` : ''} onClick={() => navigate('#/enquiries')} />
        <Kpi title="Time this week" loading={loading} value={m?.weekTotal || 0} format={fmtMin} spark={m?.timeSpark || [0, 0]} color="#8a4fd8" delta={m && { cur: m.weekTotal, prev: m.lastWeekSame, suffix: 'vs last week' }} foot="Your logged time" onClick={() => navigate('#/insights')} />
        <Kpi title="Tasks completed, 7 days" loading={loading} value={m?.done7 || 0} spark={m?.done || [0, 0]} color="#34d399" delta={m && { cur: m.done7, prev: m.donePrev }} foot={m ? `${m.myOpen} open on your list` : ''} onClick={() => navigate('#/projects')} />
      </div>

      <Panel className="xl:col-span-7" title="Your focus" sub="Assigned to you, most urgent first"
        action={<button onClick={() => navigate('#/projects')} className="text-sm text-snow/55 hover:text-snow">All projects</button>}>
        {loading ? <div className="grid grid-cols-[minmax(0,1fr)] gap-3"><Skel className="h-14" /><Skel className="h-14" /><Skel className="h-14" /></div> : !groups.length ? (
          <div className="grid place-items-center gap-3 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Icon name="check" className="h-7 w-7" /></span>
            <p className="font-semibold">You're all clear.</p>
            <p className="max-w-xs text-sm text-snow/50">Nothing overdue, due today or in progress. Tasks assigned to you will show up here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
            {groups.map(([name, list, tone]) => (
              <div key={name}>
                <p className={`mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] ${tone}`}>{name}<span className="text-snow/35">{list.length}</span></p>
                <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                  <AnimatePresence initial={false}>
                    {list.filter((t) => !gone[t.id]).slice(0, 6).map((t) => (
                      <motion.li key={t.id} layout exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }} transition={{ duration: 0.35, ease }}
                        className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/25 hover:bg-white/[0.06]">
                        <button onClick={() => complete(t)} aria-label={`Mark ${t.title} done`} className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/30 text-transparent transition-all hover:border-emerald-400 hover:bg-emerald-400/20 hover:text-emerald-300"><Icon name="check" className="h-3 w-3" /></button>
                        <button onClick={() => navigate(t.project_id ? `#/projects/${t.project_id}` : '#/projects')} className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-semibold">{t.title}</span>
                          <span className="block truncate text-xs text-snow/45">{t.projects?.name || 'Quick task'}</span>
                        </button>
                        <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold capitalize sm:inline ${PRIORITY[t.priority]}`}>{t.priority}</span>
                        {t.due_date && <span className={`text-xs ${isOverdue(t) ? 'text-pink' : 'text-snow/55'}`}>{fmtDate(t.due_date)}</span>}
                        <TimerButton task={t} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="xl:col-span-5" id="log-time"><motion.div variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}><QuickLog compact /></motion.div></div>

      <Panel className="xl:col-span-5" title="Your week" sub={loading ? '' : `${fmtMin(m.weekTotal)} logged so far`} action={<button onClick={() => navigate('#/insights')} className="text-sm text-snow/55 hover:text-snow">Insights</button>}>
        {loading ? <Skel className="h-44" /> : (
          <div>
            <div className="flex h-44 items-end gap-2.5">
              {m.week.map(({ d, v }, i) => {
                const isToday = d === today()
                const total = v?.total || 0
                const entries = v ? Object.entries(v.byCat).sort((a, b) => b[1] - a[1]) : []
                return (
                  <div key={d} className="flex h-full flex-1 flex-col justify-end" title={`${d}: ${total ? fmtMin(total) : 'nothing logged'}`}>
                    <motion.div initial={{ height: 0 }} animate={{ height: `${total ? Math.max(6, (total / maxDay) * 100) : 0}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.05, ease }}
                      className={`flex flex-col-reverse overflow-hidden rounded-lg ${isToday ? 'ring-2 ring-snow/70' : ''}`}>
                      {entries.map(([c, mins]) => <div key={c} className={colorOf(c)} style={{ height: `${(mins / total) * 100}%` }} />)}
                    </motion.div>
                    {!total && <div className="h-1.5 rounded-full bg-white/[0.06]" />}
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex gap-2.5 text-center text-[11px] text-snow/45">
              {m.week.map(({ d }) => <span key={d} className={`flex-1 ${d === today() ? 'font-semibold text-snow' : ''}`}>{parse(d).toLocaleDateString('en-GB', { weekday: 'short' })}</span>)}
            </div>
          </div>
        )}
      </Panel>

      <Panel className="xl:col-span-7" title="Website funnel" sub="Last 30 days, counted by visit" action={<button onClick={() => navigate('#/analytics')} className="text-sm text-snow/55 hover:text-snow">Analytics</button>}>
        {loading ? <div className="grid grid-cols-[minmax(0,1fr)] gap-3"><Skel className="h-10" /><Skel className="h-10" /><Skel className="h-10" /></div> : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {m.funnel.map(([name, n], i) => {
              const top = m.funnel[0][1] || 1
              const prev = i ? m.funnel[i - 1][1] : null
              return (
                <li key={name}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="text-snow/80">{name}</span>
                    <span className="flex items-baseline gap-2"><span className="font-semibold tabular-nums">{n}</span>
                      {prev ? <span className="text-xs text-snow/40">{prev ? `${Math.round((n / prev) * 100)}% of previous step` : ''}</span> : <span className="text-xs text-snow/40">100%</span>}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(n / top) * 100}%` }} transition={{ duration: 1, delay: 0.2 + i * 0.1, ease }} className="h-full rounded-full bg-gradient-to-r from-sky via-violet to-pink" />
                  </div>
                </li>
              )
            })}
            {!m.funnel[0][1] && <li className="text-sm text-snow/50">No visits recorded yet. Your own visits are excluded by default.</li>}
          </ul>
        )}
      </Panel>

      <Panel className="xl:col-span-5" title="Recent enquiries" sub={loading ? '' : `${m.newLeads} new`} action={<button onClick={() => navigate('#/enquiries')} className="text-sm text-snow/55 hover:text-snow">Open inbox</button>}>
        {loading ? <div className="grid grid-cols-[minmax(0,1fr)] gap-3"><Skel className="h-14" /><Skel className="h-14" /></div> : !data.leads.length ? <p className="text-sm text-snow/50">No enquiries yet. Messages from your contact form will appear here.</p> : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {data.leads.slice(0, 5).map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <Avatar person={{ email: l.email, full_name: l.name }} size="h-9 w-9" text="text-sm" />
                <button onClick={() => navigate('#/enquiries')} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2"><span className="truncate font-semibold">{l.name}</span>{l.status === 'new' && <span className="rounded-full bg-pink/20 px-2 py-0.5 text-[10px] font-bold uppercase text-pink">New</span>}</span>
                  <span className="block truncate text-xs text-snow/45">{l.message || l.email} · {ago(l.created_at)}</span>
                </button>
                {l.status === 'new' && <button onClick={() => markContacted(l)} title="Mark as contacted" className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-snow/70 hover:border-white/40 hover:text-snow">Contacted</button>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="xl:col-span-4" title="Projects" sub="Progress and deadlines" action={<button onClick={() => navigate('#/projects')} className="text-sm text-snow/55 hover:text-snow">All</button>}>
        {loading ? <div className="grid grid-cols-[minmax(0,1fr)] gap-4"><Skel className="h-10" /><Skel className="h-10" /></div> : !data.projects.length ? <p className="text-sm text-snow/50">No projects yet. Use the New project button to start one.</p> : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-4">
            {data.projects.slice(0, 5).map((p) => {
              const pt = data.tasks.filter((t) => t.project_id === p.id)
              const done = pt.filter((t) => t.status === 'done').length
              const pct = pt.length ? (done / pt.length) * 100 : 0
              const late = p.due_date && p.due_date < todayStr() && pct < 100
              const soon = p.due_date && !late && p.due_date <= addDays(todayStr(), 7) && pct < 100
              return (
                <li key={p.id}><button onClick={() => navigate(`#/projects/${p.id}`)} className="block w-full text-left">
                  <span className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-semibold">{p.name}</span><span className="shrink-0 text-xs text-snow/50">{done}/{pt.length}</span></span>
                  <Bar pct={pct} className="mt-2" />
                  {p.due_date && <span className={`mt-1.5 inline-block text-[11px] ${late ? 'text-pink' : soon ? 'text-amber-300' : 'text-snow/40'}`}>{late ? 'Overdue ' : 'Due '}{fmtDate(p.due_date)}</span>}
                </button></li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel className="xl:col-span-3" title="Coming up" sub="Next 7 days, whole team">
        {loading ? <div className="grid grid-cols-[minmax(0,1fr)] gap-3"><Skel className="h-10" /><Skel className="h-10" /></div> : !m.upcomingList.length ? <p className="text-sm text-snow/50">No deadlines in the next week.</p> : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {m.upcomingList.slice(0, 6).map((t) => (
              <li key={t.id}><button onClick={() => navigate(t.project_id ? `#/projects/${t.project_id}` : '#/projects')} className="flex w-full items-start gap-3 text-left">
                <span className="mt-0.5 grid w-10 shrink-0 place-items-center rounded-lg bg-white/[0.06] py-1 text-center leading-tight"><span className="text-[10px] uppercase text-snow/45">{parse(t.due_date).toLocaleDateString('en-GB', { month: 'short' })}</span><span className="text-sm font-bold">{parse(t.due_date).getDate()}</span></span>
                <span className="min-w-0"><span className="block truncate text-sm font-semibold">{t.title}</span><span className="block truncate text-xs text-snow/45">{t.projects?.name || 'Quick task'}</span></span>
              </button></li>
            ))}
          </ul>
        )}
      </Panel>

      {isSuper && data?.activity.length > 0 && (
        <Panel className="xl:col-span-12" title="Recent activity" sub="Only visible to you, the super admin" action={<button onClick={() => navigate('#/log')} className="text-sm text-snow/55 hover:text-snow">Open log</button>}>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-3 md:grid-cols-2">
            {data.activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <Avatar person={{ email: a.actor_email }} size="h-8 w-8" text="text-xs" />
                <span className="min-w-0 text-sm"><span className="block leading-snug">{a.summary}</span><span className="block truncate text-xs text-snow/45">{a.actor_email} · {ago(a.created_at)}</span></span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="flex items-center justify-center gap-2 pt-2 text-xs text-snow/35 xl:col-span-12">
        {updated ? `Updated ${updated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Loading'} · refreshes every minute
        <button onClick={load} aria-label="Refresh now" className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10 hover:text-snow"><Icon name="refresh" className={`h-3.5 w-3.5 ${spin ? 'animate-spin' : ''}`} /></button>
      </p>
    </motion.div>
  )
}
