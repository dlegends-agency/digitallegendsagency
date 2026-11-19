import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { field, btnGhost, card, Icon, ErrorNote, PageHeader } from './ui'

const roleLabel = { super_admin: 'Super admin', admin: 'Admin', none: 'No access' }
const roleStyle = { super_admin: 'bg-pink/20 text-pink', admin: 'bg-sky/20 text-sky', none: 'bg-white/10 text-snow/60' }
const needsSetup = (m) => /schema cache|does not exist|42883|PGRST202/i.test(m || '')

const when = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never')

export default function Users({ me }) {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setError('')
    const { data, error } = await supabase.rpc('list_users')
    if (error) setError(needsSetup(error.message) ? 'The user functions are not set up yet. Run the latest supabase/schema.sql in the Supabase SQL Editor, then refresh.' : error.message)
    else setUsers(data)
  }, [])
  useEffect(() => { load() }, [load])

  async function setRole(u, role) {
    const verb = role === 'admin' ? `Give ${u.email} admin access to this dashboard?` : `Remove ${u.email}'s access to this dashboard?`
    if (!window.confirm(verb)) return
    setBusy(u.user_id); setError('')
    const { error } = await supabase.rpc('set_user_role', { target: u.user_id, new_role: role })
    setBusy(null)
    if (error) setError(error.message); else load()
  }

  const q = query.trim().toLowerCase()
  const shown = (users || []).filter((u) => !q || `${u.email} ${u.full_name}`.toLowerCase().includes(q))
  const counts = (users || []).reduce((m, u) => ((m[u.role] = (m[u.role] || 0) + 1), m), {})

  return (
    <div>
      <PageHeader title="Users" sub="Everyone with an account on this project and what they can do. Only you, the super admin, can see this page.">
        <button onClick={load} className={btnGhost}><Icon name="refresh" className="h-4 w-4" />Refresh</button>
      </PageHeader>
      <ErrorNote error={error} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 text-sm">
          {['super_admin', 'admin', 'none'].map((r) => <span key={r} className={`rounded-full px-3 py-1.5 font-semibold ${roleStyle[r]}`}>{roleLabel[r]} {counts[r] || 0}</span>)}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" aria-label="Search users" className={`${field} max-w-xs py-2.5 text-sm`} />
      </div>

      {users === null && !error && <p className="text-snow/55">Loading...</p>}
      {users && !shown.length && <p className="text-snow/55">No users match.</p>}

      <ul className={`${card} divide-y divide-white/10`}>
        {shown.map((u) => (
          <li key={u.user_id} className="flex flex-wrap items-center gap-x-5 gap-y-3 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky to-pink font-bold">{(u.full_name || u.email)[0].toUpperCase()}</span>
            <div className="min-w-0 flex-1 basis-56">
              <p className="truncate font-semibold">{u.full_name || u.email.split('@')[0]}{u.user_id === me.id && <span className="ml-2 text-xs font-normal text-snow/45">(you)</span>}</p>
              <p className="truncate text-sm text-snow/55">{u.email}</p>
            </div>
            <div className="hidden text-xs text-snow/50 md:block">
              <p>Joined {when(u.created_at)}</p>
              <p>Last sign in {when(u.last_sign_in_at)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${roleStyle[u.role] || roleStyle.none}`}>{roleLabel[u.role] || u.role}</span>
            <div className="w-40 text-right">
              {u.role === 'none' && <button disabled={busy === u.user_id} onClick={() => setRole(u, 'admin')} className="pill-white rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50">Give access</button>}
              {u.role === 'admin' && <button disabled={busy === u.user_id} onClick={() => setRole(u, 'none')} className="text-sm text-pink hover:underline disabled:opacity-50">Remove access</button>}
              {u.role === 'super_admin' && <span className="text-xs text-snow/40">Cannot be changed</span>}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-snow/50">
        To add a new person, create their account in Supabase under Authentication, then use Give access here. Admins can use Projects, Enquiries, Analytics and Site content. Only the super admin can see Log and Users.
      </p>
    </div>
  )
}
