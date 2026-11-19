import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isOptedOut, setOptOut } from '../lib/track'
import { btnGhost, card, dayKey, ErrorNote, Icon, PageHeader } from './ui'

const LIMIT = 10000
const lbl = 'text-xs font-semibold uppercase tracking-[0.16em] text-snow/45'

function List({ title, rows, empty }) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <section className={`${card} p-6`}>
      <h3 className="text-lg font-semibold tracking-[-0.02em]">{title}</h3>
      <ul className="mt-4 grid gap-2">
        {rows.length === 0 && <li className="text-sm text-snow/50">{empty || 'Nothing yet.'}</li>}
        {rows.map(([k, n]) => (
          <li key={k} className="relative overflow-hidden rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
            <span className="absolute inset-y-0 left-0 bg-sky/25" style={{ width: `${(n / max) * 100}%` }} />
            <span className="relative flex justify-between gap-3"><span className="truncate">{k}</span><span className="font-semibold">{n}</span></span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const tally = (items) => Object.entries(items.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 8)

export default function Analytics() {
  const [days, setDays] = useState(30)
  const [events, setEvents] = useState(null)
  const [error, setError] = useState('')
  const [skip, setSkip] = useState(isOptedOut())

  const load = useCallback(async () => {
    setError('')
    const since = new Date(Date.now() - days * 864e5).toISOString()
    const { data, error } = await supabase.from('analytics_events').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(LIMIT)
    if (error) setError(error.message); else setEvents(data)
  }, [days])
  useEffect(() => { setEvents(null); load() }, [load])

  const s = useMemo(() => {
    if (!events) return null
    const pv = events.filter((e) => e.type === 'pageview')
    const sessions = new Set(pv.map((e) => e.session_id))
    const sent = events.filter((e) => e.type === 'form_submit')
    const converted = new Set(sent.map((e) => e.session_id))
    // first page view of each session decides its referrer and device
    const first = new Map()
    ;[...pv].reverse().forEach((e) => { if (!first.has(e.session_id)) first.set(e.session_id, e) })
    const fv = [...first.values()]
    const perDay = {}
    for (let i = days - 1; i >= 0; i--) perDay[dayKey(new Date(Date.now() - i * 864e5))] = { views: 0, visits: new Set() }
    pv.forEach((e) => { const d = perDay[dayKey(e.created_at)]; if (d) { d.views++; d.visits.add(e.session_id) } })
    const actions = events.filter((e) => ['click_out', 'cta_click', 'form_submit'].includes(e.type)).map((e) =>
      e.type === 'click_out' ? `Outside link clicked · ${e.label}` : e.type === 'cta_click' ? `Button clicked · ${e.label}` : 'Contact form sent')
    const camp = pv.filter((e) => e.utm_source).map((e) => [e.utm_source, e.utm_medium, e.utm_campaign].filter(Boolean).join(' / '))
    return {
      visits: sessions.size, views: pv.length, sent: sent.length,
      conv: sessions.size ? (converted.size / sessions.size) * 100 : 0,
      perDay: Object.entries(perDay),
      pages: tally(pv.map((e) => e.path || '/')),
      refs: tally(fv.map((e) => e.referrer || 'Direct / none')),
      devices: tally(fv.map((e) => (e.device ? e.device[0].toUpperCase() + e.device.slice(1) : 'Unknown'))),
      sections: tally(events.filter((e) => e.type === 'section').map((e) => e.label)),
      actions: tally(actions),
      camp: tally(camp),
    }
  }, [events, days])

  const maxViews = s ? Math.max(1, ...s.perDay.map(([, d]) => d.views)) : 1
  const stats = s ? [
    ['Visits', s.visits, 'one per browsing session'],
    ['Page views', s.views, s.visits ? `${(s.views / s.visits).toFixed(1)} per visit` : 'no visits yet'],
    ['Messages sent', s.sent, 'contact form'],
    ['Conversion', `${s.conv.toFixed(1)}%`, 'visits that sent a message'],
    ['Rows loaded', events.length, events.length >= LIMIT ? 'limit reached, shorten the period' : 'in this period'],
  ] : []

  return (
    <div>
      <PageHeader title="Analytics" sub="Visits to your public site, saved in your own Supabase. No cookies and no IP addresses.">
        <div className="glass flex rounded-full p-1 text-sm font-semibold">
          {[7, 30, 90].map((d) => <button key={d} onClick={() => setDays(d)} className={`rounded-full px-4 py-1.5 ${days === d ? 'bg-snow text-ink' : 'text-snow/65'}`}>{d} days</button>)}
        </div>
        <button onClick={load} className={btnGhost}><Icon name="refresh" className="h-4 w-4" />Refresh</button>
      </PageHeader>
      <ErrorNote error={error} />
      {!s && !error && <p className="text-snow/55">Loading...</p>}

      {s && (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {stats.map(([k, v, note]) => (
              <div key={k} className={`${card} p-5`}>
                <p className={lbl}>{k}</p>
                <p className="mt-2 text-3xl font-bold tracking-[-0.03em]">{v}</p>
                <p className="mt-1 text-xs text-snow/50">{note}</p>
              </div>
            ))}
          </div>

          <section className={`${card} p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold tracking-[-0.02em]">Page views per day</h3>
              <p className="text-xs text-snow/45">Bars are page views; hover for visits</p>
            </div>
            <div className="mt-6 flex h-44 items-end gap-[3px]" role="img" aria-label="Page views per day">
              {s.perDay.map(([day, d]) => (
                <div key={day} title={`${day}: ${d.views} views, ${d.visits.size} visits`} className="flex h-full flex-1 items-end rounded-sm bg-white/[0.04]">
                  <div className="w-full rounded-sm bg-gradient-to-t from-sky to-pink" style={{ height: d.views ? `${Math.max(4, (d.views / maxViews) * 100)}%` : '0' }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-snow/40"><span>{s.perDay[0][0]}</span><span>{s.perDay[s.perDay.length - 1][0]}</span></div>
          </section>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <List title="Top pages" rows={s.pages} />
            <List title="Sections viewed" rows={s.sections} empty="Appears once visitors scroll the page." />
            <List title="Where visitors came from" rows={s.refs} />
            <List title="Devices" rows={s.devices} />
            <List title="Actions" rows={s.actions} empty="Button and link clicks appear here." />
            <section className={`${card} p-6`}>
              <h3 className="text-lg font-semibold tracking-[-0.02em]">Campaigns (UTM)</h3>
              {s.camp.length ? (
                <ul className="mt-4 grid gap-2">{s.camp.map(([k, n]) => <li key={k} className="flex justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-sm"><span className="truncate">{k}</span><span className="font-semibold">{n}</span></li>)}</ul>
              ) : (
                <p className="mt-4 text-sm text-snow/50">No tagged links yet. Add <code className="rounded bg-white/10 px-1.5 py-0.5">?utm_source=linkedin</code> to a link you share.</p>
              )}
            </section>
          </div>
        </div>
      )}

      <label className="mt-8 flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" checked={skip} onChange={(e) => { setSkip(e.target.checked); setOptOut(e.target.checked) }} className="mt-1 h-4 w-4 accent-pink" />
        <span>Do not count visits from this browser
          <span className="mt-0.5 block text-xs text-snow/50">Keeps your own testing out of the numbers. Turn it off to test tracking yourself.</span>
        </span>
      </label>
    </div>
  )
}
