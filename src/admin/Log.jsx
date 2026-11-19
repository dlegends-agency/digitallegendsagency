import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { field, btnGhost, card, todayStr, dayKey, Icon, ErrorNote, PageHeader } from './ui'

const PAGE = 100
const ENTITIES = [['all', 'Everything'], ['project', 'Projects'], ['task', 'Tasks'], ['enquiry', 'Enquiries'], ['content', 'Site content'], ['blog', 'Blog'], ['resource', 'Resources'], ['user', 'Users']]
const entityStyle = {
  project: 'bg-sky/20 text-sky', task: 'bg-violet/25 text-violet', enquiry: 'bg-pink/20 text-pink',
  content: 'bg-white/10 text-snow/70', user: 'bg-amber-400/20 text-amber-300', blog: 'bg-emerald-400/20 text-emerald-300', resource: 'bg-violet/25 text-violet',
}
const actionIcon = { created: 'plus', updated: 'pencil', moved: 'refresh', deleted: 'trash', assigned: 'users', commented: 'comment' }
const actionColor = { created: 'text-emerald-300', updated: 'text-sky', moved: 'text-violet', deleted: 'text-pink', assigned: 'text-amber-300', commented: 'text-sky' }

const needsSetup = (msg) => /schema cache|does not exist|permission denied|42501|PGRST205/i.test(msg || '')
const friendly = (msg) => (needsSetup(msg) ? 'The activity log is not set up yet, or you are not the super admin. Run the latest supabase/schema.sql in the Supabase SQL Editor, then refresh.' : msg)
const time = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dayLabel = (d) => (d === todayStr() ? 'Today' : d === dayKey(new Date(Date.now() - 864e5)) ? 'Yesterday' : new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))

export default function Log() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [entity, setEntity] = useState('all')
  const [person, setPerson] = useState('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const load = useCallback(async () => {
    setError('')
    let q = supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit)
    if (entity !== 'all') q = q.eq('entity', entity)
    const { data, error } = await q
    if (error) setError(friendly(error.message)); else setRows(data)
  }, [entity, limit])
  useEffect(() => { load() }, [load])

  const people = useMemo(() => [...new Set((rows || []).map((r) => r.actor_email).filter(Boolean))].sort(), [rows])
  const q = query.trim().toLowerCase()
  const shown = (rows || []).filter((r) => (person === 'all' || r.actor_email === person) && (!q || `${r.summary} ${r.actor_email || ''}`.toLowerCase().includes(q)))

  const groups = useMemo(() => {
    const g = new Map()
    shown.forEach((r) => { const d = dayKey(r.created_at); if (!g.has(d)) g.set(d, []); g.get(d).push(r) })
    return [...g.entries()]
  }, [shown])

  return (
    <div>
      <PageHeader title="Log" sub="Everything that happens in the dashboard: who did what, and when. Only you, the super admin, can see this.">
        <button onClick={load} className={btnGhost}><Icon name="refresh" className="h-4 w-4" />Refresh</button>
      </PageHeader>

      <div className="mb-6 grid gap-4">
        <div className="flex flex-wrap gap-2">
          {ENTITIES.map(([k, l]) => (
            <button key={k} onClick={() => { setEntity(k); setLimit(PAGE) }}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${entity === k ? 'border-snow bg-snow text-ink' : 'border-white/15 text-snow/75 hover:border-white/40'}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the log" aria-label="Search the log" className={`${field} w-full py-2.5 text-sm sm:max-w-sm`} />
          <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Filter by person" className={`${field} w-full py-2.5 text-sm sm:max-w-xs`}>
            <option value="all" className="bg-ink">Everyone</option>
            {people.map((p) => <option key={p} value={p} className="bg-ink">{p}</option>)}
          </select>
        </div>
      </div>

      <ErrorNote error={error} />
      {rows === null && !error && <p className="text-snow/55">Loading...</p>}
      {rows && !shown.length && <p className="text-snow/55">{rows.length ? 'Nothing matches these filters.' : 'No activity yet. Creating, moving, editing or deleting anything will show up here.'}</p>}

      <div className="grid gap-6">
        {groups.map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-3 flex items-center gap-3 text-sm font-semibold text-snow/70">{dayLabel(day)}<span className="font-normal text-snow/40">{list.length} event{list.length === 1 ? '' : 's'}</span></h2>
            <ul className={`${card} divide-y divide-white/10`}>
              {list.map((r) => (
                <li key={r.id} className="flex items-start gap-4 p-4">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] ${actionColor[r.action] || 'text-snow/70'}`} title={r.action}>
                    <Icon name={actionIcon[r.action] || 'clock'} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug">{r.summary}</p>
                    <p className="mt-1 truncate text-xs text-snow/50">{r.actor_email || 'Unknown'} · {time(r.created_at)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${entityStyle[r.entity] || 'bg-white/10'}`}>{r.entity}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {rows && rows.length >= limit && <button onClick={() => setLimit(limit + PAGE)} className={`${btnGhost} mt-6`}>Load more</button>}
    </div>
  )
}
