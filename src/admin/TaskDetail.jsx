import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { TimerButton } from './timer'
import { fmtMin } from './time'
import { field, STATUSES, statusDot, Bar, Icon, Avatar, ErrorNote, fmtDate, fmtDateTime, isOverdue } from './ui'

const lbl = 'block text-xs font-semibold uppercase tracking-[0.16em] text-snow/45'
const ctl = `${field} mt-2 py-2.5 text-sm normal-case tracking-normal`
const needsSetup = (m) => /schema cache|does not exist|permission denied|42501|PGRST205/i.test(m || '')
const friendly = (m) => (needsSetup(m) ? 'Checklists and comments are not set up yet. Run the latest supabase/schema.sql in the Supabase SQL Editor, then refresh.' : m)

const ago = (iso) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return fmtDateTime(iso)
}

function Prop({ name, children }) {
  return <div><span className={lbl}>{name}</span>{children}</div>
}

export default function TaskDetail({ task, projects, team, me, isSuper, onClose, onChange, onDeleted, onCounts }) {
  const [t, setT] = useState(task)
  const [error, setError] = useState('')
  const [items, setItems] = useState(null)
  const [comments, setComments] = useState(null)
  const [setupError, setSetupError] = useState('')
  const [tracked, setTracked] = useState(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  useEffect(() => {
    Promise.all([
      supabase.from('task_checklist_items').select('*').eq('task_id', task.id).order('position').order('created_at'),
      supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at'),
    ]).then(([c, m]) => {
      if (c.error || m.error) setSetupError(friendly((c.error || m.error).message))
      setItems(c.data || []); setComments(m.data || [])
    })
  }, [task.id])

  useEffect(() => {
    const load = () => supabase.rpc('task_time', { task_ids: [task.id] }).then(({ data, error }) => { if (!error) setTracked(Number(data?.[0]?.minutes || 0)) })
    load()
    window.addEventListener('dl:time-changed', load)
    return () => window.removeEventListener('dl:time-changed', load)
  }, [task.id])

  const report = (list = items, cm = comments) => onCounts?.(task.id, { done: list.filter((i) => i.done).length, total: list.length, comments: cm.length })

  /* ---- task fields ---- */
  async function save(patch) {
    const prev = t
    setT({ ...t, ...patch }); setError('')
    const row = { ...patch }
    if ('status' in patch) row.completed_at = patch.status === 'done' ? (t.completed_at || new Date().toISOString()) : null
    const { data, error } = await supabase.from('tasks').update(row).eq('id', t.id).select().single()
    if (error) { setT(prev); setError(error.message); return }
    setT(data); onChange(data)
  }
  function assign(id) {
    const m = team.find((x) => x.user_id === id)
    save({ assignee_id: m ? m.user_id : null, assignee_email: m ? m.email : null })
  }
  async function remove() {
    if (!window.confirm('Delete this task, its checklist and its comments?')) return
    const { error } = await supabase.from('tasks').delete().eq('id', t.id)
    if (error) setError(error.message); else onDeleted(t.id)
  }

  /* ---- checklist ---- */
  async function addItem(e) {
    e.preventDefault()
    const form = e.currentTarget
    const text = String(new FormData(form).get('text')).trim()
    if (!text) return
    const { data, error } = await supabase.from('task_checklist_items').insert({ task_id: t.id, text, position: items.length }).select().single()
    if (error) { setError(friendly(error.message)); return }
    const next = [...items, data]; setItems(next); form.reset(); report(next)
  }
  async function toggleItem(i) {
    const next = items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x))
    setItems(next); report(next)
    const { error } = await supabase.from('task_checklist_items').update({ done: !i.done }).eq('id', i.id)
    if (error) { setItems(items); setError(friendly(error.message)); report(items) }
  }
  async function editItem(i, text) {
    text = text.trim()
    if (!text || text === i.text) return
    setItems(items.map((x) => (x.id === i.id ? { ...x, text } : x)))
    const { error } = await supabase.from('task_checklist_items').update({ text }).eq('id', i.id)
    if (error) setError(friendly(error.message))
  }
  async function removeItem(i) {
    const next = items.filter((x) => x.id !== i.id)
    setItems(next); report(next)
    const { error } = await supabase.from('task_checklist_items').delete().eq('id', i.id)
    if (error) { setItems(items); setError(friendly(error.message)); report(items) }
  }

  /* ---- comments ---- */
  async function addComment(e) {
    e.preventDefault()
    const form = e.currentTarget
    const body = String(new FormData(form).get('body')).trim()
    if (!body) return
    const { data, error } = await supabase.from('task_comments').insert({ task_id: t.id, body, author_id: me.id }).select().single()
    if (error) { setError(friendly(error.message)); return }
    const next = [...comments, data]; setComments(next); form.reset(); report(items, next)
  }
  async function removeComment(c) {
    if (!window.confirm('Delete this comment?')) return
    const next = comments.filter((x) => x.id !== c.id)
    const { error } = await supabase.from('task_comments').delete().eq('id', c.id)
    if (error) { setError(friendly(error.message)); return }
    setComments(next); report(items, next)
  }

  const person = (email, id) => team.find((m) => m.user_id === id) || team.find((m) => m.email === email) || (email ? { email } : null)
  const done = items ? items.filter((i) => i.done).length : 0
  const pct = items?.length ? Math.round((done / items.length) * 100) : 0
  const project = projects.find((p) => p.id === t.project_id)
  const creator = person(t.created_by_email)

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/70 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.aside role="dialog" aria-modal="true" aria-label="Task details"
        initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 40 }}
        className="h-full w-full max-w-5xl overflow-y-auto border-l border-white/12 bg-[#0a0b22]">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0a0b22]/95 px-6 py-4 backdrop-blur">
          <p className="flex min-w-0 items-center gap-2 text-sm text-snow/55"><Icon name="folder" className="h-4 w-4 shrink-0" /><span className="truncate">{project?.name || 'Quick task'}</span></p>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-snow/60 hover:bg-white/10 hover:text-snow"><Icon name="x" /></button>
        </header>

        <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1.7fr_1fr]">
          <div className="min-w-0">
            <input defaultValue={t.title} maxLength={300} aria-label="Task title"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.title) save({ title: v }); else e.target.value = t.title }}
              className="w-full rounded-xl border border-transparent bg-transparent px-2 py-1 text-3xl font-bold tracking-[-0.03em] outline-none hover:border-white/10 focus:border-white/30" />

            <label className={`${lbl} mt-6`}>Description
              <textarea defaultValue={t.description || ''} rows={5} maxLength={5000} placeholder="Add more detail about this task"
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== (t.description || '')) save({ description: v || null }) }}
                className={`${field} mt-2 resize-y text-base normal-case tracking-normal`} />
            </label>

            <ErrorNote error={error || setupError} />

            {/* Checklist */}
            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-[-0.02em]">Checklist {items?.length ? <span className="text-snow/45">{done}/{items.length}</span> : null}</h2>
              </div>
              {items?.length > 0 && <Bar pct={pct} className="mt-3" />}
              <ul className="mt-4 grid gap-1">
                {items?.map((i) => (
                  <li key={i.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
                    <input type="checkbox" checked={i.done} onChange={() => toggleItem(i)} aria-label={`Mark ${i.text} done`} className="h-4 w-4 shrink-0 accent-pink" />
                    <input defaultValue={i.text} maxLength={300} aria-label="Checklist item" onBlur={(e) => editItem(i, e.target.value)}
                      className={`min-w-0 flex-1 bg-transparent py-1 outline-none ${i.done ? 'text-snow/45 line-through' : ''}`} />
                    <button onClick={() => removeItem(i)} aria-label="Delete item" className="text-snow/30 opacity-0 hover:text-pink focus:opacity-100 group-hover:opacity-100"><Icon name="trash" className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
              <form onSubmit={addItem} className="mt-3 flex gap-2">
                <input name="text" maxLength={300} placeholder="Add a checklist item" aria-label="New checklist item" className={`${field} py-2.5 text-sm`} />
                <button className="pill-white shrink-0 rounded-full px-5 text-sm font-semibold">Add</button>
              </form>
            </section>

            {/* Comments */}
            <section className="mt-10">
              <h2 className="text-lg font-semibold tracking-[-0.02em]">Comments {comments?.length ? <span className="text-snow/45">{comments.length}</span> : null}</h2>
              <ul className="mt-4 grid gap-5">
                {comments && !comments.length && <li className="text-sm text-snow/50">No comments yet. Start the conversation below.</li>}
                {comments?.map((c) => {
                  const p = person(c.author_email, c.author_id)
                  return (
                    <li key={c.id} className="flex gap-3">
                      <Avatar person={p} size="h-9 w-9" text="text-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-sm"><span className="font-semibold">{p?.full_name || c.author_email || 'Unknown'}</span><span className="text-xs text-snow/45">{ago(c.created_at)}</span>
                          {(c.author_id === me.id || isSuper) && <button onClick={() => removeComment(c)} className="ml-auto text-xs text-snow/35 hover:text-pink">Delete</button>}</p>
                        <p className="mt-1 whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white/[0.05] px-4 py-3 leading-relaxed text-snow/90">{c.body}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <form onSubmit={addComment} className="mt-5 flex gap-3">
                <Avatar person={{ email: me.email, full_name: me.user_metadata?.full_name }} size="h-9 w-9" text="text-sm" />
                <div className="min-w-0 flex-1">
                  <textarea name="body" rows={3} maxLength={5000} placeholder="Write a comment. Press Ctrl+Enter to send." aria-label="New comment"
                    onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') e.currentTarget.form.requestSubmit() }}
                    className={`${field} resize-y text-sm`} />
                  <button className="pill-white mt-2 rounded-full px-5 py-2 text-sm font-semibold">Comment</button>
                </div>
              </form>
            </section>
          </div>

          {/* Properties */}
          <aside className="grid content-start gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:sticky lg:top-24">
            <Prop name="Status">
              <div className="relative">
                <span className={`pointer-events-none absolute left-4 top-1/2 mt-1 h-2 w-2 -translate-y-1/2 rounded-full ${statusDot[t.status]}`} />
                <select value={t.status} onChange={(e) => save({ status: e.target.value })} className={`${ctl} pl-9`}>{STATUSES.map(([k, l]) => <option key={k} value={k} className="bg-ink">{l}</option>)}</select>
              </div>
            </Prop>
            <Prop name="Assignee">
              <div className="mt-2 flex items-center gap-3">
                <Avatar person={team.find((m) => m.user_id === t.assignee_id) || (t.assignee_email ? { email: t.assignee_email } : null)} size="h-10 w-10" text="text-sm" />
                <select value={t.assignee_id || ''} onChange={(e) => assign(e.target.value)} aria-label="Assignee" className={`${field} py-2.5 text-sm`}>
                  <option value="" className="bg-ink">Unassigned</option>
                  {team.map((m) => <option key={m.user_id} value={m.user_id} className="bg-ink">{m.full_name || m.email}{m.user_id === me.id ? ' (you)' : ''}</option>)}
                  {t.assignee_id && !team.some((m) => m.user_id === t.assignee_id) && <option value={t.assignee_id} className="bg-ink">{t.assignee_email}</option>}
                </select>
              </div>
              {t.assignee_id !== me.id && <button onClick={() => assign(me.id)} className="mt-2 text-xs text-snow/55 underline decoration-white/20 underline-offset-4 hover:text-snow">Assign to me</button>}
            </Prop>
            <Prop name="Time tracking">
              <div className="mt-2"><TimerButton task={t} full /></div>
              {tracked !== null && <p className="mt-2 text-xs text-snow/50">{tracked ? `${fmtMin(tracked)} tracked on this task by the team` : 'No time tracked yet'}</p>}
            </Prop>
            <Prop name="Priority">
              <select value={t.priority} onChange={(e) => save({ priority: e.target.value })} className={`${ctl} capitalize`}>{['high', 'medium', 'low'].map((p) => <option key={p} value={p} className="bg-ink capitalize">{p}</option>)}</select>
            </Prop>
            <Prop name="Due date">
              <input type="date" value={t.due_date || ''} onChange={(e) => save({ due_date: e.target.value || null })} className={ctl} />
              {isOverdue(t) && <p className="mt-1.5 text-xs text-pink">Overdue since {fmtDate(t.due_date)}</p>}
            </Prop>
            <Prop name="Project">
              <select value={t.project_id || ''} onChange={(e) => save({ project_id: e.target.value || null })} className={ctl}>
                <option value="" className="bg-ink">No project (quick task)</option>
                {projects.map((p) => <option key={p.id} value={p.id} className="bg-ink">{p.name}</option>)}
              </select>
            </Prop>
            <Prop name="Tags">
              <input defaultValue={(t.tags || []).join(', ')} placeholder="design, content" aria-label="Tags"
                onBlur={(e) => { const tags = e.target.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10); if (tags.join() !== (t.tags || []).join()) save({ tags }) }}
                className={ctl} />
            </Prop>
            <div className="border-t border-white/10 pt-4 text-xs leading-relaxed text-snow/50">
              <p className="flex items-center gap-2">Created by {creator ? <><Avatar person={creator} size="h-5 w-5" text="text-[10px]" /><span className="truncate text-snow/70">{creator.full_name || creator.email}</span></> : <span>unknown</span>}</p>
              <p className="mt-1">on {fmtDateTime(t.created_at)}</p>
              {t.completed_at && <p className="mt-1">Completed {fmtDateTime(t.completed_at)}</p>}
            </div>
            <button onClick={remove} className="justify-self-start text-sm text-pink hover:underline">Delete task</button>
          </aside>
        </div>
      </motion.aside>
    </div>
  )
}
