import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import {
  field, label, btnWhite, btnGhost, card, STATUSES, statusLabel, statusDot, PRIORITY, CATEGORIES,
  fmtDate, isOverdue, todayStr, Icon, Modal, Ring, Bar, ErrorNote, PageHeader,
} from './ui'

const pctDone = (tasks) => (tasks.length ? Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100) : 0)

/* ---------------- Modals ---------------- */
function ProjectModal({ project, onClose, onSaved, onDeleted }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const row = {
      name: String(f.get('name')).trim(),
      description: String(f.get('description')).trim() || null,
      category: String(f.get('category')).trim() || null,
      due_date: f.get('due_date') || null,
    }
    setBusy(true); setError('')
    const q = project ? supabase.from('projects').update(row).eq('id', project.id).select().single() : supabase.from('projects').insert(row).select().single()
    const { data, error } = await q
    setBusy(false)
    if (error) setError(error.message); else onSaved(data)
  }
  async function remove() {
    if (!window.confirm('Delete this project and all of its tasks permanently?')) return
    const { error } = await supabase.from('projects').delete().eq('id', project.id)
    if (error) setError(error.message); else onDeleted(project.id)
  }
  return (
    <Modal title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <label className={label}>Name<input name="name" required maxLength={200} defaultValue={project?.name} autoFocus className={`${field} mt-2 normal-case tracking-normal`} /></label>
        <label className={label}>Description<textarea name="description" rows={3} maxLength={5000} defaultValue={project?.description || ''} className={`${field} mt-2 resize-none normal-case tracking-normal`} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Category
            <input name="category" list="cats" maxLength={60} defaultValue={project?.category || ''} placeholder="Website, Client..." className={`${field} mt-2 normal-case tracking-normal`} />
            <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className={label}>Due date<input name="due_date" type="date" defaultValue={project?.due_date || ''} className={`${field} mt-2 normal-case tracking-normal`} /></label>
        </div>
        <ErrorNote error={error} />
        <div className="mt-2 flex items-center justify-between gap-3">
          {project ? <button type="button" onClick={remove} className="text-sm text-pink hover:underline">Delete project</button> : <span />}
          <button disabled={busy} className={btnWhite}>{busy ? 'Saving...' : 'Save project'}</button>
        </div>
      </form>
    </Modal>
  )
}

function TaskModal({ task, defaults = {}, projects, onClose, onSaved, onDeleted }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const status = String(f.get('status'))
    const row = {
      title: String(f.get('title')).trim(),
      description: String(f.get('description')).trim() || null,
      status,
      priority: String(f.get('priority')),
      due_date: f.get('due_date') || null,
      project_id: f.get('project_id') || null,
      tags: String(f.get('tags')).split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10),
      completed_at: status === 'done' ? (task?.completed_at || new Date().toISOString()) : null,
    }
    setBusy(true); setError('')
    const q = task ? supabase.from('tasks').update(row).eq('id', task.id).select().single() : supabase.from('tasks').insert(row).select().single()
    const { data, error } = await q
    setBusy(false)
    if (error) setError(error.message); else onSaved(data)
  }
  async function remove() {
    if (!window.confirm('Delete this task?')) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) setError(error.message); else onDeleted(task.id)
  }
  const v = { ...defaults, ...task }
  return (
    <Modal title={task ? 'Edit task' : 'New task'} onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-4">
        <label className={label}>Title<input name="title" required maxLength={300} defaultValue={v.title} autoFocus className={`${field} mt-2 normal-case tracking-normal`} /></label>
        <label className={label}>Description<textarea name="description" rows={3} maxLength={5000} defaultValue={v.description || ''} className={`${field} mt-2 resize-none normal-case tracking-normal`} /></label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={label}>Status
            <select name="status" defaultValue={v.status || 'open'} className={`${field} mt-2 normal-case tracking-normal`}>{STATUSES.map(([k, l]) => <option key={k} value={k} className="bg-ink">{l}</option>)}</select>
          </label>
          <label className={label}>Priority
            <select name="priority" defaultValue={v.priority || 'medium'} className={`${field} mt-2 normal-case tracking-normal`}>{['high', 'medium', 'low'].map((p) => <option key={p} value={p} className="bg-ink capitalize">{p}</option>)}</select>
          </label>
          <label className={label}>Due date<input name="due_date" type="date" defaultValue={v.due_date || ''} className={`${field} mt-2 normal-case tracking-normal`} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Project
            <select name="project_id" defaultValue={v.project_id || ''} className={`${field} mt-2 normal-case tracking-normal`}>
              <option value="" className="bg-ink">No project (quick task)</option>
              {projects.map((p) => <option key={p.id} value={p.id} className="bg-ink">{p.name}</option>)}
            </select>
          </label>
          <label className={label}>Tags<input name="tags" defaultValue={(v.tags || []).join(', ')} placeholder="design, content" className={`${field} mt-2 normal-case tracking-normal`} /></label>
        </div>
        {task?.created_by_email && <p className="text-xs text-snow/45">Created by {task.created_by_email} on {fmtDate(task.created_at.slice(0, 10))}</p>}
        <ErrorNote error={error} />
        <div className="mt-2 flex items-center justify-between gap-3">
          {task ? <button type="button" onClick={remove} className="text-sm text-pink hover:underline">Delete task</button> : <span />}
          <button disabled={busy} className={btnWhite}>{busy ? 'Saving...' : 'Save task'}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------- Task card + board ---------------- */
// Cards are physical: they lift and tilt while dragged, spring into the column they are dropped on,
// and neighbouring cards slide to fill the gap. Pointer-based, so it also works with touch.
function TaskCard({ t, onOpen, onDrag, onDrop }) {
  const moved = useRef(false)
  return (
    <motion.div
      layout layoutId={t.id} drag dragSnapToOrigin dragMomentum={false} dragElastic={0.12}
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      whileDrag={{ scale: 1.05, rotate: 2, zIndex: 60, boxShadow: '0 28px 50px -14px rgba(0,0,0,.75)' }}
      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
      onDragStart={() => { moved.current = true }}
      onDrag={(_, info) => onDrag(info.point)}
      onDragEnd={(_, info) => { onDrop(t, info.point); setTimeout(() => { moved.current = false }, 80) }}
      onClick={() => { if (!moved.current) onOpen(t) }}
      role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(t)}
      className="glass relative cursor-grab select-none rounded-2xl p-4 hover:border-white/30 active:cursor-grabbing">
      <p className="font-semibold leading-snug">{t.title}</p>
      {t.description && <p className="mt-1.5 line-clamp-2 text-sm text-snow/55">{t.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${PRIORITY[t.priority]}`}>{t.priority}</span>
        {t.due_date && <span className={`rounded-full px-2.5 py-1 text-xs ${isOverdue(t) ? 'bg-pink/20 text-pink' : 'bg-white/10 text-snow/65'}`}>Due {fmtDate(t.due_date)}</span>}
        {t.tags?.map((g) => <span key={g} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-snow/65">{g}</span>)}
      </div>
      {t.created_by_email && <p className="mt-3 truncate text-xs text-snow/40" title={t.created_by_email}>Created by {t.created_by_email}</p>}
    </motion.div>
  )
}

function Board({ tasks, onMove, onOpen, onAdd }) {
  const [over, setOver] = useState(null)
  const colAt = (pt) => {
    const hit = document.elementsFromPoint(pt.x - window.scrollX, pt.y - window.scrollY).find((el) => el.dataset?.col)
    return hit ? hit.dataset.col : null
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STATUSES.map(([key, name, dot]) => {
        const col = tasks.filter((t) => t.status === key)
        return (
          <motion.div layout key={key} data-col={key}
            animate={{ scale: over === key ? 1.015 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`${card} min-h-[240px] p-4 transition-colors ${over === key ? 'border-pink/60 bg-pink/[0.07]' : ''}`}>
            <div className="mb-4 flex items-center gap-2 px-1 text-sm font-semibold">
              <span className={`h-2 w-2 rounded-full ${dot}`} />{name}<span className="font-normal text-snow/45">{col.length}</span>
            </div>
            <div className="grid gap-3">
              {col.map((t) => (
                <TaskCard key={t.id} t={t} onOpen={onOpen}
                  onDrag={(pt) => setOver(colAt(pt))}
                  onDrop={(task, pt) => { setOver(null); const c = colAt(pt); if (c && c !== task.status) onMove(task.id, c) }} />
              ))}
              <button onClick={() => onAdd(key)} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-snow/55 hover:bg-white/5 hover:text-snow"><Icon name="plus" className="h-4 w-4" />Add</button>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function TaskList({ tasks, onMove, onOpen }) {
  if (!tasks.length) return <p className="text-snow/55">No tasks yet.</p>
  return (
    <ul className={`${card} divide-y divide-white/10`}>
      {tasks.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center gap-3 p-4">
          <input type="checkbox" checked={t.status === 'done'} onChange={(e) => onMove(t.id, e.target.checked ? 'done' : 'open')} aria-label={`Mark ${t.title} done`} className="h-4 w-4 accent-pink" />
          <button onClick={() => onOpen(t)} className={`min-w-40 flex-1 text-left font-semibold ${t.status === 'done' ? 'text-snow/45 line-through' : ''}`}>{t.title}</button>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${PRIORITY[t.priority]}`}>{t.priority}</span>
          {t.due_date && <span className={`text-xs ${isOverdue(t) ? 'text-pink' : 'text-snow/55'}`}>Due {fmtDate(t.due_date)}</span>}
          {t.created_by_email && <span className="hidden max-w-[220px] truncate text-xs text-snow/40 lg:inline" title={t.created_by_email}>by {t.created_by_email}</span>}
          <select value={t.status} onChange={(e) => onMove(t.id, e.target.value)} aria-label="Status" className="rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1.5 text-sm">
            {STATUSES.map(([k, l]) => <option key={k} value={k} className="bg-ink">{l}</option>)}
          </select>
        </li>
      ))}
    </ul>
  )
}

/* ---------------- Project detail ---------------- */
export function ProjectDetail({ id, navigate }) {
  const [project, setProject] = useState(undefined)
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [error, setError] = useState('')
  const [view, setView] = useState(() => localStorage.getItem('dl_task_view') || 'board')
  const [taskModal, setTaskModal] = useState(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setProject(undefined)
    Promise.all([
      supabase.from('projects').select('*').eq('id', id).maybeSingle(),
      supabase.from('tasks').select('*').eq('project_id', id).order('created_at'),
      supabase.from('projects').select('id,name').order('name'),
    ]).then(([p, t, all]) => {
      const err = p.error || t.error || all.error
      if (err) setError(err.message)
      setProject(p.data || null); setTasks(t.data || []); setProjects(all.data || [])
    })
  }, [id])

  const move = useCallback(async (taskId, status) => {
    const prev = tasks
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status, completed_at: status === 'done' ? new Date().toISOString() : null } : t)))
    const { error } = await supabase.from('tasks').update({ status, completed_at: status === 'done' ? new Date().toISOString() : null }).eq('id', taskId)
    if (error) { setTasks(prev); setError(error.message) }
  }, [tasks])

  const setViewPersist = (v) => { setView(v); localStorage.setItem('dl_task_view', v) }
  const saved = (t) => { setTasks((ts) => (ts.some((x) => x.id === t.id) ? ts.map((x) => (x.id === t.id ? t : x)) : [...ts, t]).filter((x) => x.project_id === id)); setTaskModal(null) }

  if (project === undefined) return <p className="text-snow/55">Loading...</p>
  if (!project) return <div><ErrorNote error={error} /><p className="text-snow/70">Project not found.</p><button onClick={() => navigate('#/projects')} className={`${btnGhost} mt-4`}>Back to projects</button></div>

  const pct = pctDone(tasks)
  const count = (s) => tasks.filter((t) => t.status === s).length
  const overdueDays = project.due_date && project.due_date < todayStr() && pct < 100 ? Math.round((new Date(todayStr()) - new Date(project.due_date)) / 864e5) : 0

  return (
    <div>
      <button onClick={() => navigate('#/projects')} className="mb-6 inline-flex items-center gap-2 text-sm text-snow/65 hover:text-snow"><Icon name="back" className="h-4 w-4" />Projects</button>
      <ErrorNote error={error} />
      <section className={`${card} mt-2 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-6 p-6 md:p-8">
          <div className="flex items-center gap-6">
            <Ring pct={pct} />
            <div>
              {project.category && <p className="flex items-center gap-2 text-sm text-snow/65"><span className="h-2 w-2 rounded-full bg-sky" />{project.category}</p>}
              <h1 className="text-3xl font-bold tracking-[-0.04em] md:text-4xl">{project.name}</h1>
              <p className="mt-1 text-sm text-snow/55">
                {overdueDays > 0 ? <span className="text-pink">Overdue {fmtDate(project.due_date)}</span> : project.due_date ? `Due ${fmtDate(project.due_date)}` : 'No due date'} · {count('done')} / {tasks.length} tasks done
              </p>
              {project.created_by_email && <p className="mt-1 text-xs text-snow/45">Created by {project.created_by_email} on {fmtDate(project.created_at.slice(0, 10))}</p>}
              {project.description && <p className="mt-3 max-w-xl text-snow/75">{project.description}</p>}
            </div>
          </div>
          <button onClick={() => setEditing(true)} className={btnGhost}><Icon name="pencil" className="h-4 w-4" />Edit</button>
        </div>
        <div className="grid divide-white/10 border-t border-white/10 sm:grid-cols-3 sm:divide-x">
          {[
            ['Tasks done', `${count('done')} / ${tasks.length}`, <Bar pct={pct} className="mt-3" />],
            ['In progress', String(count('in_progress')), <p className="mt-1 text-sm text-snow/50">{count('blocked')} blocked · {count('open')} open</p>],
            ['Due', overdueDays > 0 ? `${overdueDays} days late` : project.due_date ? fmtDate(project.due_date) : 'None', null],
          ].map(([k, v, extra]) => (
            <div key={k} className="p-6">
              <p className={label}>{k}</p>
              <p className={`mt-2 text-2xl font-bold ${k === 'Due' && overdueDays > 0 ? 'text-pink' : ''}`}>{v}</p>
              {extra}
            </div>
          ))}
        </div>
      </section>

      <div className="mb-5 mt-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.03em]">Tasks <span className="text-snow/45">{tasks.length}</span></h2>
          <p className="mt-1 text-sm text-snow/55">{view === 'board' ? 'Drag a card to another column to change its status' : 'Tick a task to mark it done'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass flex rounded-full p-1 text-sm font-semibold">
            {['list', 'board'].map((v) => <button key={v} onClick={() => setViewPersist(v)} className={`rounded-full px-4 py-1.5 capitalize ${view === v ? 'bg-snow text-ink' : 'text-snow/65'}`}>{v}</button>)}
          </div>
          <button onClick={() => setTaskModal({ defaults: { project_id: id } })} className={btnWhite}><Icon name="plus" className="h-4 w-4" />New task</button>
        </div>
      </div>

      {view === 'board'
        ? <Board tasks={tasks} onMove={move} onOpen={(t) => setTaskModal({ task: t })} onAdd={(status) => setTaskModal({ defaults: { project_id: id, status } })} />
        : <TaskList tasks={tasks} onMove={move} onOpen={(t) => setTaskModal({ task: t })} />}

      {taskModal && <TaskModal task={taskModal.task} defaults={taskModal.defaults} projects={projects} onClose={() => setTaskModal(null)} onSaved={saved}
        onDeleted={(tid) => { setTasks((ts) => ts.filter((t) => t.id !== tid)); setTaskModal(null) }} />}
      {editing && <ProjectModal project={project} onClose={() => setEditing(false)} onSaved={(p) => { setProject(p); setEditing(false) }} onDeleted={() => navigate('#/projects')} />}
    </div>
  )
}

/* ---------------- Projects list ---------------- */
export function Projects({ navigate, openNew }) {
  const [projects, setProjects] = useState(null)
  const [tasks, setTasks] = useState([])
  const [error, setError] = useState('')
  const [cat, setCat] = useState('All')
  const [modal, setModal] = useState(openNew === 'project' ? 'project' : openNew === 'task' ? 'task' : null)

  const load = useCallback(async () => {
    const [p, t] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').order('created_at'),
    ])
    if (p.error || t.error) setError((p.error || t.error).message)
    setProjects(p.data || []); setTasks(t.data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const cats = useMemo(() => ['All', ...new Set((projects || []).map((p) => p.category).filter(Boolean))], [projects])
  const shown = (projects || []).filter((p) => cat === 'All' || p.category === cat)
  const quick = tasks.filter((t) => !t.project_id)
  const openCount = tasks.filter((t) => t.status !== 'done').length

  async function toggleQuick(t) {
    const status = t.status === 'done' ? 'open' : 'done'
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status } : x)))
    const { error } = await supabase.from('tasks').update({ status, completed_at: status === 'done' ? new Date().toISOString() : null }).eq('id', t.id)
    if (error) { setError(error.message); load() }
  }
  async function addQuick(e) {
    e.preventDefault()
    const title = new FormData(e.currentTarget).get('title').toString().trim()
    if (!title) return
    const form = e.currentTarget
    const { data, error } = await supabase.from('tasks').insert({ title }).select().single()
    if (error) setError(error.message); else { setTasks((ts) => [...ts, data]); form.reset() }
  }

  return (
    <div>
      <PageHeader title="Projects" sub={projects ? `${projects.length} project${projects.length === 1 ? '' : 's'} · ${openCount} open task${openCount === 1 ? '' : 's'}` : 'Loading...'}>
        <button onClick={() => setModal('task')} className={btnGhost}><Icon name="plus" className="h-4 w-4" />New task</button>
        <button onClick={() => setModal('project')} className={btnWhite}><Icon name="plus" className="h-4 w-4" />New project</button>
      </PageHeader>
      <ErrorNote error={error} />

      {cats.length > 2 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${cat === c ? 'border-snow bg-snow text-ink' : 'border-white/15 text-snow/75 hover:border-white/40'}`}>{c}</button>)}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map((p) => {
            const pt = tasks.filter((t) => t.project_id === p.id)
            const pct = pctDone(pt)
            const late = p.due_date && p.due_date < todayStr() && pct < 100
            return (
              <button key={p.id} onClick={() => navigate(`#/projects/${p.id}`)} className={`${card} p-6 text-left transition-colors hover:border-white/30 hover:bg-white/[0.06]`}>
                <div className="flex items-center justify-between gap-2 text-xs text-snow/60">
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky" />{p.category || 'Project'}</span>
                  {p.due_date && <span className={`rounded-full px-2.5 py-1 ${late ? 'bg-pink/20 text-pink' : 'bg-white/10'}`}>Due {fmtDate(p.due_date)}</span>}
                </div>
                <h3 className="mt-5 text-2xl font-bold tracking-[-0.03em]">{p.name}</h3>
                <Bar pct={pct} className="mt-6" />
                <p className="mt-3 flex justify-between text-xs text-snow/55"><span>{pt.length ? (pct === 100 ? 'All tasks done' : `${pt.filter((t) => t.status !== 'done').length} open`) : 'No tasks yet'}</span><span>{pt.filter((t) => t.status === 'done').length}/{pt.length}</span></p>
                {p.created_by_email && <p className="mt-4 truncate border-t border-white/10 pt-3 text-xs text-snow/45" title={p.created_by_email}>Created by {p.created_by_email}</p>}
              </button>
            )
          })}
          <button onClick={() => setModal('project')} className="grid min-h-[170px] place-items-center rounded-3xl border border-dashed border-white/15 text-snow/55 hover:border-white/40 hover:text-snow">
            <span className="grid place-items-center gap-2"><Icon name="plus" className="h-6 w-6" />New project</span>
          </button>
        </div>

        <aside className={`${card} p-6`}>
          <h2 className="text-xl font-bold tracking-[-0.03em]">Quick tasks <span className="text-snow/45">{quick.length}</span></h2>
          <p className="mt-1 text-sm text-snow/55">Tasks without a project</p>
          <ul className="mt-5 grid gap-1">
            {quick.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-lg py-1.5">
                <input type="checkbox" checked={t.status === 'done'} onChange={() => toggleQuick(t)} aria-label={`Mark ${t.title} done`} className="h-4 w-4 accent-pink" />
                <span className={t.status === 'done' ? 'text-snow/45 line-through' : ''}>{t.title}</span>
              </li>
            ))}
          </ul>
          <form onSubmit={addQuick} className="mt-4 flex gap-2">
            <input name="title" maxLength={300} placeholder="Add a quick task" aria-label="Quick task title" className={`${field} py-2 text-sm`} />
            <button className={`${btnWhite} px-4`} aria-label="Add"><Icon name="plus" className="h-4 w-4" /></button>
          </form>
        </aside>
      </div>

      {modal === 'project' && <ProjectModal onClose={() => setModal(null)} onSaved={(p) => { setModal(null); navigate(`#/projects/${p.id}`) }} />}
      {modal === 'task' && <TaskModal projects={projects || []} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </div>
  )
}
