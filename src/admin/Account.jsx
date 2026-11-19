import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { field, btnWhite, card, PageHeader } from './ui'

const lbl = 'block text-xs font-semibold uppercase tracking-[0.16em] text-snow/45'
const inp = `${field} mt-2 normal-case tracking-normal`

function Note({ note }) {
  if (!note) return null
  return <p role={note.ok ? 'status' : 'alert'} className={`rounded-xl border p-3 text-sm ${note.ok ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : 'border-pink/40 bg-pink/10 text-pink'}`}>{note.text}</p>
}

export default function Account({ user }) {
  const meta = user.user_metadata || {}
  const [profileNote, setProfileNote] = useState(null)
  const [pwNote, setPwNote] = useState(null)
  const [busy, setBusy] = useState('')

  async function saveProfile(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy('profile'); setProfileNote(null)
    const data = {
      ...meta,
      full_name: String(f.get('full_name')).trim(),
      job_title: String(f.get('job_title')).trim(),
      phone: String(f.get('phone')).trim(),
      bio: String(f.get('bio')).trim(),
    }
    const { error } = await supabase.auth.updateUser({ data })
    setBusy('')
    setProfileNote(error ? { text: error.message } : { ok: true, text: 'Profile saved.' })
  }

  async function changePassword(e) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const current = String(f.get('current')), next = String(f.get('next')), again = String(f.get('again'))
    setPwNote(null)
    if (next.length < 8) { setPwNote({ text: 'The new password must be at least 8 characters.' }); return }
    if (next !== again) { setPwNote({ text: 'The new passwords do not match.' }); return }
    if (next === current) { setPwNote({ text: 'Choose a password different from the current one.' }); return }
    setBusy('password')
    // Confirm the current password first, so a borrowed open session cannot change it.
    const check = await supabase.auth.signInWithPassword({ email: user.email, password: current })
    if (check.error) { setBusy(''); setPwNote({ text: 'The current password is wrong.' }); return }
    const { error } = await supabase.auth.updateUser({ password: next })
    setBusy('')
    if (error) setPwNote({ text: error.message })
    else { setPwNote({ ok: true, text: 'Password changed. Use the new one next time you sign in.' }); form.reset() }
  }

  const initial = (meta.full_name || user.email)[0].toUpperCase()
  const since = user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

  return (
    <div>
      <PageHeader title="Account settings" sub="Your details and password. Only you can change these." />
      <div className="grid items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <form onSubmit={saveProfile} className={`${card} grid gap-5 p-6 md:p-8`}>
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-sky to-pink text-2xl font-bold">{initial}</span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{meta.full_name || 'Your name'}</p>
              <p className="truncate text-sm text-snow/55">{user.email}</p>
              {since && <p className="text-xs text-snow/40">Member since {since}</p>}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={lbl}>Full name<input name="full_name" maxLength={100} defaultValue={meta.full_name || ''} autoComplete="name" className={inp} /></label>
            <label className={lbl}>Job title<input name="job_title" maxLength={100} defaultValue={meta.job_title || ''} placeholder="e.g. Project manager" className={inp} /></label>
            <label className={lbl}>Email<input value={user.email} readOnly disabled className={`${inp} opacity-60`} /></label>
            <label className={lbl}>Phone<input name="phone" type="tel" maxLength={40} defaultValue={meta.phone || ''} autoComplete="tel" className={inp} /></label>
          </div>
          <label className={lbl}>About you<textarea name="bio" rows={3} maxLength={500} defaultValue={meta.bio || ''} placeholder="A short note for your teammates" className={`${inp} resize-none`} /></label>
          <Note note={profileNote} />
          <button disabled={busy === 'profile'} className={`${btnWhite} justify-self-start`}>{busy === 'profile' ? 'Saving...' : 'Save profile'}</button>
        </form>

        <form onSubmit={changePassword} className={`${card} grid gap-5 p-6 md:p-8`}>
          <div><h2 className="text-xl font-bold tracking-[-0.03em]">Change password</h2><p className="mt-1 text-sm text-snow/55">Use at least 8 characters.</p></div>
          <label className={lbl}>Current password<input name="current" type="password" required autoComplete="current-password" className={inp} /></label>
          <label className={lbl}>New password<input name="next" type="password" required minLength={8} autoComplete="new-password" className={inp} /></label>
          <label className={lbl}>Repeat new password<input name="again" type="password" required minLength={8} autoComplete="new-password" className={inp} /></label>
          <Note note={pwNote} />
          <button disabled={busy === 'password'} className={`${btnWhite} justify-self-start`}>{busy === 'password' ? 'Changing...' : 'Change password'}</button>
        </form>
      </div>
    </div>
  )
}
