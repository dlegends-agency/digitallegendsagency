import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { card, Icon, ErrorNote, PageHeader } from './ui'
import { useCategories, COLORS } from './data'
import { fetchEntries, byDay, streak, today, parse, ymd, addDays, mondayOf, daysBetween, fmtMin, needsSetup, setupMessage } from './time'

const lbl = 'text-xs font-semibold uppercase tracking-[0.16em] text-snow/45'
const long = (s) => parse(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const short = (s) => parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function periodRange(mode, offset) {
  const t = parse(today())
  if (mode === 'week') {
    const start = addDays(mondayOf(today()), offset * 7)
    const end = addDays(start, 6)
    return { start, end, label: `${short(start)} – ${short(end)}`, name: offset === 0 ? 'This week' : `Week of ${short(start)}` }
  }
  if (mode === 'year') {
    const y = t.getFullYear() + offset
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y), name: String(y) }
  }
  const d = new Date(t.getFullYear(), t.getMonth() + offset, 1)
  const end = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))
  const month = d.toLocaleDateString('en-GB', { month: 'long' })
  return { start: ymd(d), end, label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), name: month, month }
}

export default function Insights({ me }) {
  const cats = useCategories()
  const [entries, setEntries] = useState(null)
  const [done, setDone] = useState([])
  const [error, setError] = useState('')
  const [mode, setMode] = useState('month')
  const [offset, setOffset] = useState(0)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    fetchEntries(addDays(today(), -800)).then(({ data, error }) => { if (error) setError(needsSetup(error.message) ? setupMessage : error.message); else setEntries(data) })
    supabase.from('tasks').select('id,completed_at').eq('status', 'done').eq('assignee_id', me.id).then(({ data }) => setDone((data || []).filter((t) => t.completed_at).map((t) => ymd(new Date(t.completed_at)))))
  }, [me.id])

  const colorClass = (name) => COLORS[cats.categories.find((c) => c.name === name)?.color] || 'bg-snow/50'
  const all = useMemo(() => byDay(entries || []), [entries])
  const range = periodRange(mode, offset)
  const now = today()

  const p = useMemo(() => {
    const days = [...all.entries()].filter(([d]) => d >= range.start && d <= range.end)
    const total = days.reduce((a, [, v]) => a + v.total, 0)
    const per = {}
    days.forEach(([, v]) => Object.entries(v.byCat).forEach(([c, m]) => { per[c] = (per[c] || 0) + m }))
    const perCat = Object.entries(per).sort((a, b) => b[1] - a[1])
    const best = days.reduce((b, [d, v]) => (v.total > (b?.[1].total || 0) ? [d, v] : b), null)
    const elapsed = range.start > now ? 0 : daysBetween(range.start, range.end < now ? range.end : now) + 1
    return { total, perCat, best, active: days.length, elapsed, tasks: done.filter((d) => d >= range.start && d <= range.end).length }
  }, [all, range.start, range.end, done, now])

  const sentence = !entries ? 'Loading your time...' : !p.total
    ? `Nothing logged ${mode === 'month' ? `in ${range.name}` : offset === 0 ? `${mode === 'week' ? 'this week' : 'this year'}` : `for ${range.name}`} yet. Log time from the Today page.`
    : <>{range.name}{offset === 0 ? ' so far' : ''}: <strong>{fmtMin(p.total)}</strong> logged. Most of it went to <strong className="text-pink">{p.perCat[0][0]}</strong>.</>

  /* ---- squares for week / month ---- */
  const squares = useMemo(() => {
    if (mode === 'year') return null
    const lead = (parse(range.start).getDay() + 6) % 7
    const n = daysBetween(range.start, range.end) + 1
    return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => addDays(range.start, i))]
  }, [mode, range.start, range.end])

  const cell = (d) => {
    const v = all.get(d)
    const future = d > now
    return {
      cls: v ? colorClass(v.top) : future ? 'bg-white/[0.02]' : 'bg-white/[0.05]',
      style: v ? { opacity: Math.min(1, 0.35 + (v.total / 240) * 0.65) } : undefined,
      text: `${long(d)}: ${v ? `${fmtMin(v.total)} logged, mostly ${v.top}` : future ? 'upcoming' : 'nothing logged'}`,
    }
  }

  /* ---- last 12 months ---- */
  const heat = useMemo(() => {
    const start = mondayOf(addDays(now, -364))
    const weeks = Math.floor(daysBetween(start, now) / 7) + 1
    const labels = []
    let prev = -1
    for (let c = 0; c < weeks; c++) {
      const m = parse(addDays(start, c * 7)).getMonth()
      if (m !== prev) { labels.push([c, MONTHS[m]]); prev = m }
    }
    return { start, weeks, labels }
  }, [now])

  /* ---- year view: months ---- */
  const months = useMemo(() => {
    if (mode !== 'year') return null
    const year = range.start.slice(0, 4)
    return MONTHS.map((name, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`
      const per = {}
      for (const [d, v] of all) if (d.startsWith(key)) Object.entries(v.byCat).forEach(([c, m]) => { per[c] = (per[c] || 0) + m })
      const total = Object.values(per).reduce((a, b) => a + b, 0)
      return { name, per: Object.entries(per).sort((a, b) => b[1] - a[1]), total }
    })
  }, [mode, all, range.start])
  const maxMonth = months ? Math.max(1, ...months.map((m) => m.total)) : 1

  const dayText = hover || (squares && now >= range.start && now <= range.end ? cell(now).text : '')
  const stats = [
    ['Active days', String(p.active), `of ${p.elapsed} days`],
    ['Best day', p.best ? fmtMin(p.best[1].total) : '–', p.best ? parse(p.best[0]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'nothing yet'],
    ['Day streak', String(streak(all)), `${streak(all) === 1 ? 'day' : 'days'} logged in a row`],
    ['Tasks done', String(p.tasks), p.tasks === 1 ? 'task assigned to you' : 'tasks assigned to you'],
    ['Average per active day', p.active ? fmtMin(Math.round(p.total / p.active)) : '–', 'on days you logged'],
  ]

  return (
    <div>
      <PageHeader title="Insights" sub="Where your time actually went." />
      <ErrorNote error={error} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="glass flex rounded-full p-1 text-sm font-semibold">
          {[['week', 'Week'], ['month', 'Month'], ['year', 'Year']].map(([k, l]) => <button key={k} onClick={() => { setMode(k); setOffset(0) }} className={`rounded-full px-5 py-1.5 ${mode === k ? 'bg-snow text-ink' : 'text-snow/65'}`}>{l}</button>)}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => setOffset(offset - 1)} aria-label="Previous period" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><Icon name="back" className="h-4 w-4" /></button>
          <span className="min-w-36 text-center font-semibold">{range.label}</span>
          <button onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Next period" className="grid h-9 w-9 rotate-180 place-items-center rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"><Icon name="back" className="h-4 w-4" /></button>
        </div>
      </div>

      <section className={`${card} px-6 py-5 text-lg`}>{sentence}</section>

      <section className={`${card} mt-4 p-6 md:p-8`}>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className={lbl}>Logged {mode === 'month' ? range.month : mode === 'year' ? range.label : offset === 0 ? 'this week' : 'that week'}</p>
            <p className="mt-2 text-6xl font-bold tracking-[-0.05em] md:text-7xl">{entries ? fmtMin(p.total) : '–'}</p>
            <div className="mt-5 flex h-1.5 overflow-hidden rounded-full bg-white/10">
              {p.perCat.map(([c, v]) => <div key={c} className={colorClass(c)} style={{ width: `${(v / p.total) * 100}%` }} title={`${c} ${fmtMin(v)}`} />)}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-snow/70">
              {p.perCat.map(([c, v]) => <li key={c} className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${colorClass(c)}`} />{c} <span className="font-semibold text-snow">{fmtMin(v)}</span></li>)}
            </ul>

            {months && (
              <div className="mt-8" role="img" aria-label="Time logged per month">
                <div className="flex h-40 items-end gap-2">
                  {months.map((m) => (
                    <div key={m.name} className="flex h-full flex-1 flex-col justify-end" title={`${m.name}: ${fmtMin(m.total)}`}>
                      <div className="flex flex-col-reverse overflow-hidden rounded-md" style={{ height: `${(m.total / maxMonth) * 100}%` }}>
                        {m.per.map(([c, v]) => <div key={c} className={colorClass(c)} style={{ height: `${(v / m.total) * 100}%` }} />)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2 text-center text-[11px] text-snow/45">{months.map((m) => <span key={m.name} className="flex-1">{m.name}</span>)}</div>
              </div>
            )}
          </div>

          {squares && (
            <div className="lg:w-72" onMouseLeave={() => setHover(null)}>
              <p className={lbl}>{mode === 'month' ? `${range.month} squares` : 'Week squares'}</p>
              <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[10px] text-snow/40">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
              <div className="mt-1.5 grid grid-cols-7 gap-1.5">
                {squares.map((d, i) => {
                  if (!d) return <span key={`b${i}`} />
                  const c = cell(d)
                  return <button key={d} onMouseEnter={() => setHover(c.text)} onFocus={() => setHover(c.text)} aria-label={c.text} className={`aspect-square rounded-md ${c.cls} ${d === now ? 'ring-2 ring-snow' : ''}`} style={c.style} />
                })}
              </div>
              <p className="mt-4 min-h-5 text-xs text-snow/55">{dayText}</p>
            </div>
          )}
        </div>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(([k, v, note]) => (
          <div key={k} className={`${card} p-5`}>
            <p className={lbl}>{k}</p>
            <p className="mt-2 text-3xl font-bold tracking-[-0.03em]">{v}</p>
            <p className="mt-1 text-xs text-snow/50">{note}</p>
          </div>
        ))}
      </div>

      <section className={`${card} mt-4 p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">The last 12 months</h2>
          <p className="text-xs text-snow/45">Each square is a day, coloured by where most time went</p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="relative mb-1.5 h-4 text-[10px] uppercase text-snow/40" style={{ display: 'grid', gridTemplateColumns: `repeat(${heat.weeks}, minmax(0, 1fr))` }}>
              {heat.labels.map(([c, name]) => <span key={`${c}${name}`} className="whitespace-nowrap" style={{ gridColumn: c + 1 }}>{name}</span>)}
            </div>
            <div className="grid gap-[3px]" style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 1fr)', gridTemplateColumns: `repeat(${heat.weeks}, minmax(0, 1fr))` }}>
              {Array.from({ length: heat.weeks * 7 }, (_, i) => {
                const d = addDays(heat.start, Math.floor(i / 7) * 7 + (i % 7))
                if (d > now) return <span key={i} className="aspect-square rounded-[3px] bg-white/[0.015]" />
                const c = cell(d)
                return <span key={i} title={c.text} className={`aspect-square rounded-[3px] ${c.cls} ${d === now ? 'ring-1 ring-snow' : ''}`} style={c.style} />
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
