import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { field, btnGhost, card, todayStr, fmtDate, dayKey, Icon, ErrorNote, PageHeader } from './ui'

const lbl = 'text-xs font-semibold uppercase tracking-[0.16em] text-snow/45'
const CATS = [['Development', 'bg-sky'], ['Design', 'bg-violet'], ['Marketing', 'bg-pink'], ['Client work', 'bg-emerald-400'], ['Admin', 'bg-amber-400'], ['Meetings', 'bg-snow/60']]
const dot = Object.fromEntries(CATS)
const QUICK = [[15, '15M'], [30, '30M'], [60, '1H'], [120, '2H']]

export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}H${m % 60 ? ` ${m % 60}M` : ''}` : `${m}M`)
const needsSetup = (msg) => /schema cache|does not exist|permission denied|42501|PGRST205/i.test(msg || '')
const friendly = (msg) => (needsSetup(msg) ? 'This part of the database is not set up yet. Run the latest supabase/schema.sql in the Supabase SQL Editor, then refresh.' : msg)
const ago = (iso) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
const dayLabel = (d) => (d === todayStr() ? 'Today' : d === dayKey(new Date(Date.now() - 864e5)) ? 'Yesterday' : new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }))

/* ---------------- Time ---------------- */
function TimeLog() {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')
  const [cat, setCat] = useState(CATS[0][0])
  const [note, setNote] = useState('')
  const [custom, setCustom] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const since = dayKey(new Date(Date.now() - 30 * 864e5))
    const { data, error } = await supabase.from('time_entries').select('*').gte('entry_date', since).order('entry_date', { ascending: false }).order('created_at', { ascending: false })
    if (error) setError(friendly(error.message)); else setEntries(data)
  }, [])
  useEffect(() => { load() }, [load])

  async function add(minutes) {
    if (!minutes || minutes < 1 || minutes > 1440) { setError('Enter between 1 minute and 24 hours.'); return }
    setBusy(true); setError('')
    const { data, error } = await supabase.from('time_entries').insert({ minutes, category: cat, note: note.trim() || null, entry_date: todayStr() }).select().single()
    setBusy(false)
    if (error) { setError(friendly(error.message)); return }
    setEntries((es) => [data, ...(es || [])]); setNote(''); setCustom(false)
  }
  async function remove(id) {
    const { error } = await supabase.from('time_entries').delete().eq('id', id)
    if (error) { setError(friendly(error.message)); return }
    setEntries((es) => es.filter((e) => e.id !== id))
  }
  function submitCustom(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    add(Number(f.get('h') || 0) * 60 + Number(f.get('m') || 0))
  }

  const m = useMemo(() => {
    const list = entries || []
    const today = list.filter((e) => e.entry_date === todayStr()).reduce((a, e) => a + e.minutes, 0)
    const weekStart = dayKey(new Date(Date.now() - 6 * 864e5))
    const week = list.filter((e) => e.entry_date >= weekStart)
    const byCat = CATS.map(([c]) => [c, week.filter((e) => e.category === c).reduce((a, e) => a + e.minutes, 0)])
    const groups = {}
    list.forEach((e) => { (groups[e.entry_date] ||= []).push(e) })
    return { today, byCat, weekTotal: week.reduce((a, e) => a + e.minutes, 0), groups: Object.entries(groups) }
  }, [entries])
  const maxCat = Math.max(1, ...m.byCat.map(([, v]) => v))

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
      <div className="grid gap-4">
        <section className={`${card} p-6 md:p-8`}>
          <p className={lbl}>Logged today</p>
          <p className="mt-2 text-6xl font-bold tracking-[-0.05em]">{entries ? (m.today ? fmtMin(m.today) : '0M') : '–'}</p>
          <p className="mt-6 text-sm text-snow/55">1. Pick what you worked on</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATS.map(([c, d]) => (
              <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${cat === c ? 'border-snow bg-white/10' : 'border-white/15 text-snow/70 hover:border-white/40'}`}>
                <span className={`h-2 w-2 rounded-full ${d}`} />{c}
              </button>
            ))}
          </div>
          <p className="mt-6 text-sm text-snow/55">2. Tap a duration to log it</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK.map(([mins, l]) => <button key={l} disabled={busy} onClick={() => add(mins)} className="rounded-full border border-white/15 px-5 py-2 font-mono text-sm font-semibold hover:border-pink hover:bg-pink/10 disabled:opacity-50">{l}</button>)}
            <button onClick={() => setCustom(!custom)} className={`rounded-full border px-5 py-2 font-mono text-sm font-semibold ${custom ? 'border-snow bg-white/10' : 'border-white/15 hover:border-white/40'}`}>Custom</button>
          </div>
          {custom && (
            <form onSubmit={submitCustom} className="mt-3 flex flex-wrap items-center gap-2">
              <input name="h" type="number" min="0" max="24" placeholder="Hours" aria-label="Hours" className={`${field} w-28 py-2 text-sm`} />
              <input name="m" type="number" min="0" max="59" placeholder="Minutes" aria-label="Minutes" className={`${field} w-28 py-2 text-sm`} />
              <button disabled={busy} className="pill-white rounded-full px-5 py-2 text-sm font-semibold">Log time</button>
            </form>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional note, for example 'Homepage fixes'" aria-label="Note" className={`${field} mt-5 text-sm`} />
          <div className="mt-4"><ErrorNote error={error} /></div>
        </section>

        {entries && !entries.length && !error && <p className="text-snow/55">No time logged in the last 30 days.</p>}
        {m.groups.map(([day, list]) => (
          <section key={day} className={`${card} p-6`}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">{dayLabel(day)}</h3><span className="font-mono text-sm text-snow/55">{fmtMin(list.reduce((a, e) => a + e.minutes, 0))}</span></div>
            <ul className="mt-3 divide-y divide-white/10">
              {list.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dot[e.category] || 'bg-snow/50'}`} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{e.category}</span>
                    <span className="block truncate text-xs text-snow/50">{[e.note, e.created_by_email].filter(Boolean).join(' · ')}</span></span>
                  <span className="font-mono text-sm">{fmtMin(e.minutes)}</span>
                  <button onClick={() => remove(e.id)} aria-label="Delete entry" className="text-snow/40 hover:text-pink"><Icon name="trash" className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className={`${card} p-6`}>
        <h3 className="text-lg font-semibold tracking-[-0.02em]">Last 7 days</h3>
        <p className="mt-1 text-sm text-snow/55">{entries ? fmtMin(m.weekTotal || 0) : '–'} in total</p>
        <ul className="mt-5 grid gap-4">
          {m.byCat.map(([c, v]) => (
            <li key={c}>
              <div className="flex justify-between text-sm"><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${dot[c]}`} />{c}</span><span className="font-mono text-snow/60">{v ? fmtMin(v) : '0M'}</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${dot[c]}`} style={{ width: `${(v / maxCat) * 100}%`, transition: 'width .5s' }} /></div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

/* ---------------- Activity ---------------- */
const ENTITIES = [['all', 'All'], ['project', 'Projects'], ['task', 'Tasks'], ['enquiry', 'Enquiries'], ['content', 'Content']]
const entityStyle = { project: 'bg-sky/20 text-sky', task: 'bg-violet/25 text-violet', enquiry: 'bg-pink/20 text-pink', content: 'bg-white/10 text-snow/70' }

function Activity() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [entity, setEntity] = useState('all')
  const [limit, setLimit] = useState(60)

  const load = useCallback(async () => {
    setError('')
    let q = supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit)
    if (entity !== 'all') q = q.eq('entity', entity)
    const { data, error } = await q
    if (error) setError(friendly(error.message)); else setRows(data)
  }, [entity, limit])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ENTITIES.map(([k, l]) => <button key={k} onClick={() => { setEntity(k); setLimit(60) }} className={`rounded-full border px-4 py-2 text-sm font-semibold ${entity === k ? 'border-snow bg-snow text-ink' : 'border-white/15 text-snow/75 hover:border-white/40'}`}>{l}</button>)}
        </div>
        <button onClick={load} className={btnGhost}><Icon name="refresh" className="h-4 w-4" />Refresh</button>
      </div>
      <ErrorNote error={error} />
      {rows === null && !error && <p className="text-snow/55">Loading...</p>}
      {rows && !rows.length && <p className="text-snow/55">No activity yet. Creating, moving, editing or deleting anything will show up here.</p>}
      <ul className={`${card} divide-y divide-white/10`}>
        {rows?.map((r) => (
          <li key={r.id} className="flex items-start gap-4 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky to-pink text-sm font-bold">{(r.actor_email || '?')[0].toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="leading-snug">{r.summary}</p>
              <p className="mt-1 truncate text-xs text-snow/50">{r.actor_email || 'Unknown'} · {ago(r.created_at)}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${entityStyle[r.entity] || 'bg-white/10'}`}>{r.entity}</span>
          </li>
        ))}
      </ul>
      {rows && rows.length >= limit && <button onClick={() => setLimit(limit + 60)} className={`${btnGhost} mt-4`}>Load more</button>}
    </div>
  )
}

export default function Log() {
  const [tab, setTab] = useState('time')
  return (
    <div>
      <PageHeader title="Log" sub={tab === 'time' ? 'Track where your time goes.' : 'Who created, moved, edited or deleted what.'}>
        <div className="glass flex rounded-full p-1 text-sm font-semibold">
          {[['time', 'Time'], ['activity', 'Activity']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-full px-5 py-1.5 ${tab === k ? 'bg-snow text-ink' : 'text-snow/65'}`}>{l}</button>)}
        </div>
      </PageHeader>
      {tab === 'time' ? <TimeLog /> : <Activity />}
    </div>
  )
}
