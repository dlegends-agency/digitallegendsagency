import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { field, card, Icon, ErrorNote } from './ui'
import { useCategories, COLORS } from './data'
import { fetchEntries, byDay, streak, today, addDays, fmtMin, needsSetup, setupMessage } from './time'

const lbl = 'text-xs font-semibold uppercase tracking-[0.16em] text-snow/45'
const QUICK = [[15, '15M'], [30, '30M'], [60, '1H'], [120, '2H']]

/* "Logged today" panel: pick a category, tap a duration. Shown at the top of Today. */
export default function QuickLog({ compact = false }) {
  const cats = useCategories()
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')
  const [cat, setCat] = useState('')
  const [note, setNote] = useState('')
  const [custom, setCustom] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await fetchEntries(addDays(today(), -90))
    if (error) setError(needsSetup(error.message) ? setupMessage : error.message); else setEntries(data)
  }, [])
  useEffect(() => {
    load()
    window.addEventListener('dl:time-changed', load)
    return () => window.removeEventListener('dl:time-changed', load)
  }, [load])
  useEffect(() => { if (!cat && cats.categories.length) setCat(cats.categories[0].name) }, [cats.categories, cat])

  const colorOf = (name) => COLORS[cats.categories.find((c) => c.name === name)?.color] || 'bg-snow/50'
  const m = useMemo(() => {
    const list = (entries || []).filter((e) => e.entry_date === today())
    const total = list.reduce((a, e) => a + e.minutes, 0)
    const per = {}
    list.forEach((e) => { per[e.category] = (per[e.category] || 0) + e.minutes })
    return { list, total, per: Object.entries(per).sort((a, b) => b[1] - a[1]), streak: streak(byDay(entries || [])) }
  }, [entries])

  async function add(minutes) {
    if (!minutes || minutes < 1 || minutes > 1440) { setError('Enter between 1 minute and 24 hours.'); return }
    setBusy(true); setError('')
    const { data, error } = await supabase.from('time_entries').insert({ entry_date: today(), minutes, category: cat, note: note.trim() || null }).select().single()
    setBusy(false)
    if (error) { setError(needsSetup(error.message) ? setupMessage : error.message); return }
    setEntries((es) => [data, ...(es || [])]); setNote(''); setCustom(false)
  }
  async function remove(id) {
    const { error } = await supabase.from('time_entries').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setEntries((es) => es.filter((e) => e.id !== id))
  }

  return (
    <section className={`${card} ${compact ? 'h-full p-6' : 'p-6 md:p-8'}`}>
      <div className={`grid gap-8 ${compact ? '' : 'lg:grid-cols-[1.3fr_1fr]'}`}>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className={lbl}>Logged today</p>
            {m.streak > 1 && <span className="flex items-center gap-1.5 rounded-full border border-sky/40 bg-sky/10 px-3 py-1 text-xs font-semibold text-sky"><Icon name="check" className="h-3.5 w-3.5" />{m.streak}-day streak</span>}
          </div>
          <p className={`mt-2 font-bold tracking-[-0.05em] ${compact ? 'text-5xl' : 'text-6xl'}`}>{entries ? fmtMin(m.total) : '–'}</p>
          <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-white/10">
            {m.per.map(([c, v]) => <div key={c} className={colorOf(c)} style={{ width: `${(v / m.total) * 100}%` }} title={`${c} ${fmtMin(v)}`} />)}
          </div>

          <div className="mt-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
            {cats.categories.map((c) => (
              <button key={c.id} role="radio" aria-checked={cat === c.name} onClick={() => setCat(c.name)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${cat === c.name ? 'border-snow bg-white/10' : 'border-white/15 text-snow/70 hover:border-white/40'}`}>
                <span className={`h-2 w-2 rounded-full ${COLORS[c.color]}`} />{c.name}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK.map(([mins, l]) => <button key={l} disabled={busy || !cat} onClick={() => add(mins)} className="rounded-full border border-white/15 px-5 py-2 font-mono text-sm font-semibold hover:border-pink hover:bg-pink/10 disabled:opacity-50">{l}</button>)}
            <button onClick={() => setCustom(!custom)} className={`rounded-full border px-5 py-2 font-mono text-sm font-semibold ${custom ? 'border-snow bg-white/10' : 'border-white/15 hover:border-white/40'}`}>Custom</button>
          </div>
          {custom && (
            <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); add(Number(f.get('h') || 0) * 60 + Number(f.get('m') || 0)) }} className="mt-3 flex flex-wrap items-center gap-2">
              <input name="h" type="number" min="0" max="24" placeholder="Hours" aria-label="Hours" className={`${field} w-28 py-2 text-sm`} />
              <input name="m" type="number" min="0" max="59" placeholder="Minutes" aria-label="Minutes" className={`${field} w-28 py-2 text-sm`} />
              <button disabled={busy} className="pill-white rounded-full px-5 py-2 text-sm font-semibold">Log time</button>
            </form>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional note, for example 'Homepage fixes'" aria-label="Note" className={`${field} mt-4 text-sm`} />
          <div className="mt-3"><ErrorNote error={error} /></div>
        </div>

        <div>
          <p className={lbl}>Logged</p>
          <ul className="mt-3 divide-y divide-white/10">
            {entries && !m.list.length && <li className="py-3 text-sm text-snow/50">No time logged today. Pick a category and tap a duration.</li>}
            {m.list.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${colorOf(e.category)}`} />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{e.category}</span>{e.note && <span className="block truncate text-xs text-snow/50">{e.note}</span>}</span>
                <span className="font-mono text-sm">{fmtMin(e.minutes)}</span>
                <button onClick={() => remove(e.id)} aria-label="Delete entry" className="text-snow/35 hover:text-pink"><Icon name="trash" className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
