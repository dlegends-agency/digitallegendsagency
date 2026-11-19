import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { defaults, mergeContent } from '../lib/useSiteContent'

const field = 'w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-snow placeholder:text-snow/35 outline-none transition-colors focus:border-white/40'
const btn = 'rounded-full px-5 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0'
const btnWhite = `${btn} pill-white`
const btnGhost = `${btn} glass text-snow hover:bg-white/10`

function useNoIndex() {
  useEffect(() => {
    document.title = 'Admin | Digital Legends Agency'
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex, nofollow'
    document.head.appendChild(m)
    return () => m.remove()
  }, [])
}

/* ---------------- Login ---------------- */
function Login() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get('email')).trim(), password: String(f.get('password')) })
    if (error) setError('Wrong email or password.')
    setBusy(false)
  }
  return (
    <div className="grid min-h-svh place-items-center px-4">
      <form onSubmit={submit} className="glass w-full max-w-md rounded-3xl p-8 md:p-10">
        <img src="/img/logo.webp" alt="Digital Legends Agency" className="h-10 w-auto" />
        <h1 className="mt-8 text-3xl font-bold tracking-[-0.04em]">Admin sign in</h1>
        <p className="mt-2 text-snow/60">Use the account created for this site.</p>
        <div className="mt-8 grid gap-4">
          <input name="email" type="email" required autoComplete="email" placeholder="Email" aria-label="Email" className={field} />
          <input name="password" type="password" required autoComplete="current-password" placeholder="Password" aria-label="Password" className={field} />
          {error && <p role="alert" className="text-sm text-pink">{error}</p>}
          <button disabled={busy} className={`${btnWhite} mt-2 py-3.5`}>{busy ? 'Signing in...' : 'Sign in'}</button>
        </div>
      </form>
    </div>
  )
}

/* ---------------- Leads ---------------- */
const statuses = ['new', 'contacted', 'closed']
const statusStyle = { new: 'bg-pink/20 text-pink', contacted: 'bg-sky/20 text-sky', closed: 'bg-white/10 text-snow/60' }

function Leads() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
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
  const shown = rows?.filter((r) => filter === 'all' || r.status === filter) || []

  async function update(id, patch) {
    const { error } = await supabase.from('leads').update(patch).eq('id', id)
    if (error) { setError(error.message); return }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  async function remove(id) {
    if (!window.confirm('Delete this lead permanently?')) return
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setRows((rs) => rs.filter((r) => r.id !== id))
  }
  function exportCsv() {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = ['Date,Name,Email,Status,Message,Note', ...shown.map((r) => [r.created_at, r.name, r.email, r.status, r.message, r.note].map(q).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {['all', ...statuses].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${filter === s ? 'border-snow bg-snow text-ink' : 'border-white/15 text-snow/75 hover:border-white/40'}`}>
              {s} <span className="opacity-60">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className={btnGhost}>Refresh</button>
          <button onClick={exportCsv} disabled={!shown.length} className={btnGhost}>Export CSV</button>
        </div>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl border border-pink/40 bg-pink/10 p-4 text-sm text-pink">{error}</p>}
      {rows === null && !error && <p className="mt-10 text-snow/60">Loading...</p>}
      {rows && !shown.length && <p className="mt-10 text-snow/60">No leads here yet. Submissions from the contact form appear in this list.</p>}

      <ul className="mt-6 space-y-3">
        {shown.map((r) => (
          <li key={r.id} className="glass rounded-2xl">
            <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 p-5 text-left">
              <span className="min-w-40 font-semibold">{r.name}</span>
              <span className="text-snow/65">{r.email}</span>
              <span className="ml-auto flex items-center gap-4">
                <span className="text-sm text-snow/45">{new Date(r.created_at).toLocaleString()}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle[r.status]}`}>{r.status}</span>
              </span>
            </button>
            {open === r.id && (
              <div className="grid gap-5 border-t border-white/10 p-5 md:grid-cols-[1.4fr_1fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-snow/45">Message</p>
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed text-snow/85">{r.message || 'No message.'}</p>
                  <a href={`mailto:${r.email}`} className={`${btnWhite} mt-5 inline-block`}>Reply by email</a>
                </div>
                <div className="grid content-start gap-3">
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
                  <button onClick={() => remove(r.id)} className="justify-self-start text-sm text-pink hover:underline">Delete lead</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------- Content editor ---------------- */
function Section({ title, hint, children, onSave, onReset, state }) {
  return (
    <section className="glass rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.03em]">{title}</h3>
          <p className="mt-1 text-sm text-snow/55">{hint}</p>
        </div>
        <div className="flex items-center gap-2">
          {state && <span className={`text-sm ${state === 'Saved' || state === 'Reset' ? 'text-snow/70' : 'text-pink'}`}>{state}</span>}
          <button onClick={onReset} className={btnGhost}>Reset to default</button>
          <button onClick={onSave} className={btnWhite}>Save</button>
        </div>
      </div>
      <div className="mt-6 grid gap-4">{children}</div>
    </section>
  )
}

function ListEditor({ rows, onChange, titleLabel }) {
  return rows.map(([t, d], i) => (
    <div key={i} className="grid gap-3 rounded-2xl border border-white/10 p-4 md:grid-cols-[0.8fr_1.4fr]">
      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-snow/45">{titleLabel} {i + 1}
        <input value={t} onChange={(e) => onChange(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} className={`${field} mt-2 text-base normal-case tracking-normal`} />
      </label>
      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-snow/45">Description
        <textarea value={d} rows={2} onChange={(e) => onChange(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))} className={`${field} mt-2 resize-none text-base normal-case tracking-normal`} />
      </label>
    </div>
  ))
}

function Content() {
  const [content, setContent] = useState(null)
  const [error, setError] = useState('')
  const [state, setState] = useState({})

  useEffect(() => {
    supabase.from('site_content').select('key,value').then(({ data, error }) => {
      if (error) setError(error.message); else setContent(mergeContent(data))
    })
  }, [])

  const flash = (key, msg) => {
    setState((s) => ({ ...s, [key]: msg }))
    setTimeout(() => setState((s) => ({ ...s, [key]: '' })), 3000)
  }
  async function save(key) {
    const value = content[key]
    const ok = key === 'hero' ? Object.values(value).every((v) => v.trim()) : value.every((r) => r.every((x) => x.trim()))
    if (!ok) { flash(key, 'No field can be empty'); return }
    const { error } = await supabase.from('site_content').upsert({ key, value, updated_at: new Date().toISOString() })
    flash(key, error ? error.message : 'Saved')
  }
  async function reset(key) {
    if (!window.confirm('Go back to the original text for this section?')) return
    const { error } = await supabase.from('site_content').delete().eq('key', key)
    if (error) { flash(key, error.message); return }
    setContent((c) => ({ ...c, [key]: defaults[key] }))
    flash(key, 'Reset')
  }
  const set = (key) => (value) => setContent((c) => ({ ...c, [key]: value }))

  if (error) return <p role="alert" className="rounded-xl border border-pink/40 bg-pink/10 p-4 text-sm text-pink">{error}</p>
  if (!content) return <p className="text-snow/60">Loading...</p>
  const h = content.hero

  return (
    <div className="grid gap-6">
      <Section title="Hero" hint="The first thing visitors read." state={state.hero} onSave={() => save('hero')} onReset={() => reset('hero')}>
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-snow/45">Headline, line 1
          <input value={h.line1} onChange={(e) => set('hero')({ ...h, line1: e.target.value })} className={`${field} mt-2 text-base normal-case tracking-normal`} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-snow/45">Headline, line 2
          <input value={h.line2} onChange={(e) => set('hero')({ ...h, line2: e.target.value })} className={`${field} mt-2 text-base normal-case tracking-normal`} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-snow/45">Paragraph
          <textarea value={h.text} rows={3} onChange={(e) => set('hero')({ ...h, text: e.target.value })} className={`${field} mt-2 resize-none text-base normal-case tracking-normal`} />
        </label>
      </Section>
      <Section title="Services" hint="Names and descriptions of the service cards." state={state.services} onSave={() => save('services')} onReset={() => reset('services')}>
        <ListEditor rows={content.services} onChange={set('services')} titleLabel="Service" />
      </Section>
      <Section title="Process steps" hint="The four steps under 'Research first. Then build.'" state={state.steps} onSave={() => save('steps')} onReset={() => reset('steps')}>
        <ListEditor rows={content.steps} onChange={set('steps')} titleLabel="Step" />
      </Section>
      <Section title="Principles" hint="The list under 'What we stand on.'" state={state.principles} onSave={() => save('principles')} onReset={() => reset('principles')}>
        <ListEditor rows={content.principles} onChange={set('principles')} titleLabel="Principle" />
      </Section>
    </div>
  )
}

/* ---------------- Shell ---------------- */
function Dashboard({ session }) {
  const [tab, setTab] = useState('leads')
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <img src="/img/logo.webp" alt="Digital Legends Agency" className="h-9 w-auto" />
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-snow/60">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm text-snow/60 hover:text-snow">View site</a>
          <span className="hidden text-sm text-snow/40 sm:inline">{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} className={btnGhost}>Sign out</button>
        </div>
      </header>
      <nav className="mt-10 flex gap-2 border-b border-white/10 pb-4" aria-label="Admin sections">
        {[['leads', 'Leads'], ['content', 'Site content']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold ${tab === k ? 'bg-snow text-ink' : 'text-snow/70 hover:bg-white/10'}`}>{l}</button>
        ))}
      </nav>
      <main className="mt-8">{tab === 'leads' ? <Leads /> : <Content />}</main>
    </div>
  )
}

export default function Admin() {
  useNoIndex()
  const [session, setSession] = useState(undefined)
  const [isAdmin, setIsAdmin] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setIsAdmin(null); return }
    supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
      .then(({ data, error }) => setIsAdmin(!error && !!data))
  }, [session])

  if (session === undefined) return <div className="min-h-svh" />
  if (!session) return <Login />
  if (isAdmin === null) return <div className="grid min-h-svh place-items-center text-snow/60">Checking access...</div>
  if (!isAdmin) {
    return (
      <div className="grid min-h-svh place-items-center px-4">
        <div className="glass max-w-md rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-bold tracking-[-0.03em]">No admin access</h1>
          <p className="mt-3 text-snow/65">{session.user.email} is signed in but is not on the admin list. Add it in Supabase, then sign in again.</p>
          <button onClick={() => supabase.auth.signOut()} className={`${btnWhite} mt-6`}>Sign out</button>
        </div>
      </div>
    )
  }
  return <Dashboard session={session} />
}
