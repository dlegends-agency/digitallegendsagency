import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { field, btnWhite, btnGhost, card, fmtDateTime, ErrorNote, PageHeader } from './ui'

const statuses = ['new', 'contacted', 'closed']
const statusStyle = { new: 'bg-pink/20 text-pink', contacted: 'bg-sky/20 text-sky', closed: 'bg-white/10 text-snow/60' }

export default function Enquiries({ onChanged }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)

  const load = useCallback(async () => {
    setError('')
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message); else setRows(data)
  }, [])
  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const c = { all: rows?.length || 0, new: 0, contacted: 0, closed: 0 }
    rows?.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1 })
    return c
  }, [rows])

  const q = query.trim().toLowerCase()
  const shown = (rows || []).filter((r) => (filter === 'all' || r.status === filter) && (!q || `${r.name} ${r.email} ${r.message || ''}`.toLowerCase().includes(q)))

  async function update(id, patch) {
    const { error } = await supabase.from('leads').update(patch).eq('id', id)
    if (error) { setError(error.message); return }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    onChanged?.()
  }
  async function remove(id) {
    if (!window.confirm('Delete this enquiry permanently?')) return
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setRows((rs) => rs.filter((r) => r.id !== id))
    onChanged?.()
  }
  const toggle = (r) => setOpen(open === r.id ? null : r.id)
  function exportCsv() {
    const qt = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = ['Date,Name,Email,Status,Message,Note', ...shown.map((r) => [r.created_at, r.name, r.email, r.status, r.message, r.note].map(qt).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `enquiries-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <PageHeader title="Enquiries" sub="Everything sent through the contact form on your website.">
        <button onClick={load} className={btnGhost}>Refresh</button>
        <button onClick={exportCsv} disabled={!shown.length} className={btnGhost}>Export CSV</button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {['all', ...statuses].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${filter === s ? 'border-snow bg-snow text-ink' : 'border-white/15 text-snow/75 hover:border-white/40'}`}>
              {s} <span className="opacity-60">{counts[s]}</span>
            </button>
          ))}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or message" aria-label="Search enquiries" className={`${field} w-full py-2.5 text-sm sm:max-w-xs`} />
      </div>

      <ErrorNote error={error} />
      {rows === null && !error && <p className="text-snow/55">Loading...</p>}
      {rows && !shown.length && <p className="text-snow/55">{rows.length ? 'No enquiries match.' : 'No enquiries yet. Messages from the contact form will appear here.'}</p>}

      <ul className="grid gap-3">
        {shown.map((r) => (
          <li key={r.id} className={card}>
            <button onClick={() => toggle(r)} className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 p-5 text-left">
              <span className="min-w-40 font-semibold">{r.name}</span>
              <span className="min-w-0 text-snow/65">{r.email}</span>
              <span className="ml-auto flex items-center gap-4">
                <span className="text-sm text-snow/45">{fmtDateTime(r.created_at)}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle[r.status]}`}>{r.status}</span>
              </span>
            </button>
            {open === r.id && (
              <div className="grid gap-6 border-t border-white/10 p-5 md:grid-cols-[1.4fr_1fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-snow/45">Message</p>
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed text-snow/85">{r.message || 'No message.'}</p>
                  <a href={`mailto:${r.email}?subject=${encodeURIComponent('Re: your enquiry to Digital Legends Agency')}`} className={`${btnWhite} mt-5`}>Reply by email</a>
                </div>
                <div className="grid content-start gap-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-snow/45">Status
                    <select value={r.status} onChange={(e) => update(r.id, { status: e.target.value })} className={`${field} mt-2 text-sm normal-case tracking-normal`}>
                      {statuses.map((s) => <option key={s} value={s} className="bg-ink">{s}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-snow/45">Private note
                    <textarea defaultValue={r.note || ''} rows={3} maxLength={5000} placeholder="Only you can see this"
                      onBlur={(e) => e.target.value !== (r.note || '') && update(r.id, { note: e.target.value || null })}
                      className={`${field} mt-2 resize-none text-sm normal-case tracking-normal`} />
                  </label>
                  <button onClick={() => remove(r.id)} className="justify-self-start text-sm text-pink hover:underline">Delete enquiry</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
