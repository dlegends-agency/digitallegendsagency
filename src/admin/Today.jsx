import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { card, fmtDate, fmtDateTime, isOverdue, dayKey, statusLabel, statusDot, Bar, ErrorNote, Icon } from './ui'

const lbl = 'text-xs font-semibold uppercase tracking-[0.16em] text-snow/45'

export default function Today({ user, navigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const since = new Date(Date.now() - 7 * 864e5).toISOString()
    Promise.all([
      supabase.from('leads').select('id,name,email,status,created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('tasks').select('*, projects(name)').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('analytics_events').select('session_id,type,created_at').eq('type', 'pageview').gte('created_at', since).limit(5000),
    ]).then(([l, t, p, a]) => {
      const err = l.error || t.error || p.error || a.error
      if (err) setError(err.message)
      setData({ leads: l.data || [], tasks: t.data || [], projects: p.data || [], views: a.data || [] })
    })
  }, [])

  const m = useMemo(() => {
    if (!data) return null
    const open = data.tasks.filter((t) => t.status !== 'done')
    const attention = open.filter((t) => t.status === 'in_progress' || t.status === 'blocked' || isOverdue(t) || (t.due_date && t.due_date <= new Date(Date.now() + 7 * 864e5).toLocaleDateString('en-CA'))).slice(0, 8)
    const days = Array.from({ length: 7 }, (_, i) => dayKey(new Date(Date.now() - (6 - i) * 864e5)))
    const perDay = Object.fromEntries(days.map((d) => [d, 0]))
    data.views.forEach((v) => { const k = dayKey(v.created_at); if (k in perDay) perDay[k]++ })
    return {
      newLeads: data.leads.filter((l) => l.status === 'new').length,
      visits: new Set(data.views.map((v) => v.session_id)).size,
      open: open.length,
      overdue: open.filter(isOverdue).length,
      attention, perDay: Object.entries(perDay),
    }
  }, [data])

  async function complete(t) {
    setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, status: 'done' } : x)) }))
    const { error } = await supabase.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', t.id)
    if (error) setError(error.message)
  }

  const raw = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0]
  const name = raw.charAt(0).toUpperCase() + raw.slice(1)
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const maxDay = m ? Math.max(1, ...m.perDay.map(([, n]) => n)) : 1

  return (
    <div className="grid gap-4">
      <section className={`${card} flex items-center gap-4 p-5 md:p-6`}>
        <img src="/img/logo.webp" alt="" className="hidden h-9 w-auto sm:block" />
        <div>
          <p className={lbl}>{today}</p>
          <p className="mt-1 text-lg md:text-xl">
            {m ? <>Hi {name}. {m.newLeads} new enquir{m.newLeads === 1 ? 'y is' : 'ies are'} waiting and {m.open} task{m.open === 1 ? ' is' : 's are'} open{m.overdue ? `, ${m.overdue} overdue` : ''}.</> : `Hi ${name}.`}
          </p>
        </div>
      </section>
      <ErrorNote error={error} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['New enquiries', m?.newLeads, 'enquiries', `${data?.leads.length ?? 0} in total`],
          ['Visits, 7 days', m?.visits, 'analytics', 'one per browsing session'],
          ['Open tasks', m?.open, 'projects', `${data?.projects.length ?? 0} projects`],
          ['Overdue', m?.overdue, 'projects', 'tasks past their due date'],
        ].map(([k, v, to, note]) => (
          <button key={k} onClick={() => navigate(`#/${to}`)} className={`${card} p-5 text-left transition-colors hover:border-white/30 hover:bg-white/[0.06]`}>
            <p className={lbl}>{k}</p>
            <p className={`mt-2 text-4xl font-bold tracking-[-0.04em] ${k === 'Overdue' && v ? 'text-pink' : ''}`}>{v ?? '–'}</p>
            <p className="mt-1 text-xs text-snow/50">{note}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className={`${card} p-6`}>
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold tracking-[-0.03em]">Tasks <span className="text-snow/45">{m?.attention.length ?? 0}</span></h2>
            <button onClick={() => navigate('#/projects')} className="text-sm text-snow/55 hover:text-snow">See all</button></div>
          <ul className="mt-4 divide-y divide-white/10">
            {m && !m.attention.length && <li className="py-3 text-snow/55">Nothing due or in progress.</li>}
            {m?.attention.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <input type="checkbox" onChange={() => complete(t)} checked={t.status === 'done'} aria-label={`Mark ${t.title} done`} className="h-4 w-4 accent-pink" />
                <button onClick={() => navigate(t.project_id ? `#/projects/${t.project_id}` : '#/projects')} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold">{t.title}</span>
                  <span className="block truncate text-xs text-snow/50">{t.projects?.name || 'Quick task'}</span>
                </button>
                <span className="hidden items-center gap-1.5 text-xs text-snow/60 sm:flex"><span className={`h-2 w-2 rounded-full ${statusDot[t.status]}`} />{statusLabel[t.status]}</span>
                {t.due_date && <span className={`text-xs ${isOverdue(t) ? 'text-pink' : 'text-snow/55'}`}>{fmtDate(t.due_date)}</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className={`${card} p-6`}>
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold tracking-[-0.03em]">Recent enquiries</h2>
            <button onClick={() => navigate('#/enquiries')} className="text-sm text-snow/55 hover:text-snow">Open</button></div>
          <ul className="mt-4 divide-y divide-white/10">
            {data && !data.leads.length && <li className="py-3 text-snow/55">No enquiries yet.</li>}
            {data?.leads.slice(0, 5).map((l) => (
              <li key={l.id}><button onClick={() => navigate('#/enquiries')} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                <span className="min-w-0"><span className="block truncate font-semibold">{l.name}</span><span className="block truncate text-xs text-snow/50">{l.email}</span></span>
                <span className="shrink-0 text-right text-xs text-snow/50">{fmtDateTime(l.created_at)}{l.status === 'new' && <span className="ml-2 rounded-full bg-pink/20 px-2 py-0.5 font-semibold text-pink">New</span>}</span>
              </button></li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className={`${card} p-6`}>
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold tracking-[-0.03em]">Projects</h2>
            <button onClick={() => navigate('#/projects')} className="text-sm text-snow/55 hover:text-snow">Open</button></div>
          <ul className="mt-4 grid gap-4">
            {data && !data.projects.length && <li className="text-snow/55">No projects yet. Create one from the New button.</li>}
            {data?.projects.slice(0, 5).map((p) => {
              const pt = data.tasks.filter((t) => t.project_id === p.id)
              const done = pt.filter((t) => t.status === 'done').length
              return (
                <li key={p.id}><button onClick={() => navigate(`#/projects/${p.id}`)} className="block w-full text-left">
                  <span className="flex justify-between text-sm"><span className="font-semibold">{p.name}</span><span className="text-snow/50">{done}/{pt.length}</span></span>
                  <Bar pct={pt.length ? (done / pt.length) * 100 : 0} className="mt-2" />
                </button></li>
              )
            })}
          </ul>
        </section>
        <section className={`${card} p-6`}>
          <h2 className="text-xl font-bold tracking-[-0.03em]">Page views, 7 days</h2>
          <div className="mt-6 flex h-32 items-end gap-2">
            {m?.perDay.map(([d, n]) => (
              <div key={d} title={`${d}: ${n}`} className="flex h-full flex-1 items-end rounded-md bg-white/[0.04]">
                <div className="w-full rounded-md bg-gradient-to-t from-sky to-pink" style={{ height: n ? `${Math.max(6, (n / maxDay) * 100)}%` : 0 }} />
              </div>
            ))}
          </div>
          <button onClick={() => navigate('#/analytics')} className="mt-4 inline-flex items-center gap-1.5 text-sm text-snow/60 hover:text-snow">Full analytics <Icon name="external" className="h-3.5 w-3.5" /></button>
        </section>
      </div>
    </div>
  )
}
