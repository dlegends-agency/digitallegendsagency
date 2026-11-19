import { supabase } from '../lib/supabase'

/* Dates are plain 'YYYY-MM-DD' strings in the user's local time, so there is no timezone drift. */
export const ymd = (d) => d.toLocaleDateString('en-CA')
export const today = () => ymd(new Date())
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d) }
export const mondayOf = (s) => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d) }
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5)

export const fmtMin = (m) => (!m ? '0M' : m >= 60 ? `${Math.floor(m / 60)}H${m % 60 ? ` ${m % 60}M` : ''}` : `${m}M`)
export const needsSetup = (m) => /schema cache|does not exist|permission denied|42501|PGRST205/i.test(m || '')
export const setupMessage = 'Time tracking is not set up yet. Run the latest supabase/schema.sql in the Supabase SQL Editor, then refresh.'

export async function fetchEntries(since) {
  const { data, error } = await supabase.from('time_entries').select('*').gte('entry_date', since).order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(20000)
  return { data: data || [], error }
}

/* Groups entries by day: { total, byCat, top } where top is the category with the most time that day. */
export function byDay(entries) {
  const map = new Map()
  for (const e of entries) {
    const d = map.get(e.entry_date) || { total: 0, byCat: {}, top: null }
    d.total += e.minutes
    d.byCat[e.category] = (d.byCat[e.category] || 0) + e.minutes
    map.set(e.entry_date, d)
  }
  for (const d of map.values()) d.top = Object.entries(d.byCat).sort((a, b) => b[1] - a[1])[0][0]
  return map
}

/* Consecutive days with time logged, ending today (or yesterday if today is still empty). */
export function streak(map) {
  let day = today()
  if (!map.has(day)) day = addDays(day, -1)
  let n = 0
  while (map.has(day)) { n++; day = addDays(day, -1) }
  return n
}
