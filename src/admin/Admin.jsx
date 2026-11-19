import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { setOptOut } from '../lib/track'
import { field, btnWhite, btnGhost, Icon } from './ui'
import Today from './Today'
import { Projects, ProjectDetail } from './Projects'
import Enquiries from './Enquiries'
import Analytics from './Analytics'
import Content from './Content'

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

function useHash() {
  const [hash, setHash] = useState(window.location.hash || '#/today')
  useEffect(() => {
    const f = () => { setHash(window.location.hash || '#/today'); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return [hash, (h) => { window.location.hash = h }]
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

/* ---------------- Shell ---------------- */
const nav = [
  { to: 'today', label: 'Today', icon: 'sun' },
  { to: 'projects', label: 'Projects', icon: 'folder' },
]
const siteNav = [
  { to: 'enquiries', label: 'Enquiries', icon: 'inbox' },
  { to: 'analytics', label: 'Analytics', icon: 'chart' },
  { to: 'content', label: 'Site content', icon: 'doc' },
]

function Dashboard({ session }) {
  const [hash, navigate] = useHash()
  const [open, setOpen] = useState(false)
  const [newMenu, setNewMenu] = useState(false)
  const [newCount, setNewCount] = useState(0)

  const refreshBadge = useCallback(async () => {
    const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new')
    setNewCount(count || 0)
  }, [])
  useEffect(() => { refreshBadge() }, [refreshBadge, hash])

  // Keep the owner's own visits out of the analytics by default (can be switched off on the Analytics page).
  useEffect(() => {
    try { if (!localStorage.getItem('dl_no_track_init')) { setOptOut(true); localStorage.setItem('dl_no_track_init', '1') } } catch { /* ignore */ }
  }, [])

  const [path, qs] = hash.slice(1).split('?')
  const seg = path.split('/').filter(Boolean)
  const route = seg[0] || 'today'
  const params = new URLSearchParams(qs || '')
  const go = (to) => { navigate(`#/${to}`); setOpen(false) }

  const Item = ({ to, label, icon, badge }) => (
    <button onClick={() => go(to)} aria-current={route === to ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${route === to ? 'bg-white/10 text-snow' : 'text-snow/70 hover:bg-white/5 hover:text-snow'}`}>
      <Icon name={icon} className="h-5 w-5" />{label}
      {badge > 0 && <span className="ml-auto rounded-full bg-pink px-2 py-0.5 text-xs font-bold text-white">{badge}</span>}
    </button>
  )

  let page
  if (route === 'projects' && seg[1]) page = <ProjectDetail id={seg[1]} navigate={navigate} key={seg[1]} />
  else if (route === 'projects') page = <Projects navigate={navigate} openNew={params.get('new')} key={hash} />
  else if (route === 'enquiries') page = <Enquiries onChanged={refreshBadge} />
  else if (route === 'analytics') page = <Analytics />
  else if (route === 'content') page = <Content />
  else page = <Today user={session.user} navigate={navigate} />

  return (
    <div className="min-h-svh lg:pl-64">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-ink/90 px-4 py-3 backdrop-blur lg:hidden">
        <img src="/img/logo.webp" alt="Digital Legends Agency" className="h-8 w-auto" />
        <button onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open} className="grid h-10 w-10 place-items-center rounded-full glass"><Icon name={open ? 'x' : 'menu'} /></button>
      </div>

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-[#070819] p-4 overflow-x-hidden overflow-y-auto transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="hidden items-center px-2 pb-4 pt-2 lg:flex"><img src="/img/logo.webp" alt="Digital Legends Agency" className="h-9 w-auto" /></div>
        <div className="relative">
          <button onClick={() => setNewMenu(!newMenu)} className="pill-white flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold"><Icon name="plus" />New</button>
          {newMenu && (
            <div className="absolute inset-x-0 top-full z-10 mt-2 grid gap-1 rounded-xl border border-white/12 bg-[#0d0f2b] p-2 shadow-xl">
              {[['New project', 'project'], ['New task', 'task']].map(([l, k]) => (
                <button key={k} onClick={() => { setNewMenu(false); go(`projects?new=${k}`) }} className="rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/10">{l}</button>
              ))}
            </div>
          )}
        </div>

        <nav className="mt-5 grid gap-1" aria-label="Admin">
          {nav.map((n) => <Item key={n.to} {...n} />)}
          <p className="mb-1 mt-6 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-snow/35">Website</p>
          {siteNav.map((n) => <Item key={n.to} {...n} badge={n.to === 'enquiries' ? newCount : 0} />)}
        </nav>

        <div className="mt-auto flex min-w-0 flex-col gap-3 pt-6">
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 text-sm text-snow/60 hover:text-snow"><Icon name="external" className="h-4 w-4" />View site</a>
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky to-pink text-sm font-bold">{session.user.email[0].toUpperCase()}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-snow/65" title={session.user.email}>{session.user.email}</span>
            <button onClick={() => supabase.auth.signOut()} aria-label="Sign out" title="Sign out" className="text-snow/55 hover:text-snow"><Icon name="logout" className="h-5 w-5" /></button>
          </div>
        </div>
      </aside>
      {open && <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/60 lg:hidden" />}

      <main className="w-full px-4 py-8 md:px-10 md:py-10">{page}</main>
    </div>
  )
}

/* ---------------- Gate ---------------- */
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
