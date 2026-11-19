import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './ui'
import { ymd, fmtMin, needsSetup } from './time'

const Ctx = createContext(null)
export const useTimer = () => useContext(Ctx)

export const fmtClock = (ms) => {
  const s = Math.floor(ms / 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

/* Elapsed milliseconds since startedAt, ticking every second. Only mounted where a timer is running. */
export function useElapsed(startedAt) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!startedAt) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return startedAt ? Math.max(0, now - new Date(startedAt).getTime()) : 0
}

export function TimerProvider({ me, children }) {
  const [timer, setTimer] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  const say = useCallback((text, bad = false) => {
    setToast({ text, bad })
    setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 6000)
  }, [])

  useEffect(() => {
    supabase.from('timers').select('*').eq('user_id', me.id).maybeSingle().then(({ data }) => setTimer(data || null))
  }, [me.id])

  /* Logs the elapsed time as a time entry on the task, then clears the timer. */
  async function finish(t) {
    const mins = Math.min(1440, Math.max(1, Math.round((Date.now() - new Date(t.started_at).getTime()) / 60000)))
    const { error } = await supabase.from('time_entries').insert({
      entry_date: ymd(new Date(t.started_at)), minutes: mins, category: t.category || 'General', note: t.task_title.slice(0, 500), task_id: t.task_id,
    })
    if (error) throw error
    await supabase.from('timers').delete().eq('user_id', me.id)
    window.dispatchEvent(new Event('dl:time-changed'))
    return mins
  }
  const fail = (e) => say(needsSetup(e.message) || /task_id|timers/i.test(e.message) ? 'Timers are not set up yet. Run the latest supabase/schema.sql in the Supabase SQL Editor.' : e.message, true)

  const start = useCallback(async (task) => {
    if (busy) return
    setBusy(true)
    try {
      let note = ''
      if (timer) { const mins = await finish(timer); note = `Logged ${fmtMin(mins)} to "${timer.task_title}". ` }
      let category = null
      if (task.project_id) {
        const { data } = await supabase.from('projects').select('category').eq('id', task.project_id).maybeSingle()
        category = data?.category || null
      }
      const { data, error } = await supabase.from('timers').upsert({ user_id: me.id, task_id: task.id, task_title: task.title, category, started_at: new Date().toISOString() }, { onConflict: 'user_id' }).select().single()
      if (error) throw error
      setTimer(data)
      say(`${note}Timer started on "${task.title}".`)
    } catch (e) { fail(e) } finally { setBusy(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, timer, me.id])

  const stop = useCallback(async () => {
    if (!timer || busy) return
    setBusy(true)
    try {
      const mins = await finish(timer)
      setTimer(null)
      say(`Logged ${fmtMin(mins)} to "${timer.task_title}".`)
    } catch (e) { fail(e) } finally { setBusy(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, busy])

  const discard = useCallback(async () => {
    if (!timer || !window.confirm('Discard this timer without logging any time?')) return
    await supabase.from('timers').delete().eq('user_id', me.id)
    setTimer(null)
  }, [timer, me.id])

  const value = useMemo(() => ({ timer, busy, start, stop, discard }), [timer, busy, start, stop, discard])
  return (
    <Ctx.Provider value={value}>
      {children}
      <TimerBar toast={toast} dismiss={() => setToast(null)} />
    </Ctx.Provider>
  )
}

function Clock({ startedAt, className = '' }) {
  return <span className={`font-mono tabular-nums ${className}`}>{fmtClock(useElapsed(startedAt))}</span>
}

/* Play / stop button for one task. Compact on cards, labelled in the task panel. */
export function TimerButton({ task, full = false }) {
  const t = useTimer()
  if (!t) return null
  const running = t.timer?.task_id === task.id
  const stopDrag = (e) => e.stopPropagation()
  if (full) {
    return (
      <button onClick={() => (running ? t.stop() : t.start(task))} disabled={t.busy}
        className={`flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${running ? 'border-pink/60 bg-pink/15 text-snow' : 'border-white/15 hover:border-white/40 hover:bg-white/5'}`}>
        <Icon name={running ? 'stop' : 'play'} className="h-4 w-4" />
        {running ? <><span>Stop timer</span><Clock startedAt={t.timer.started_at} className="text-pink" /></> : 'Start timer'}
      </button>
    )
  }
  return (
    <button onPointerDown={stopDrag} onClick={(e) => { e.stopPropagation(); running ? t.stop() : t.start(task) }} disabled={t.busy}
      aria-label={running ? `Stop timer on ${task.title}` : `Start timer on ${task.title}`} title={running ? 'Stop timer' : 'Start timer'}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${running ? 'border-pink/60 bg-pink/15 text-snow' : 'border-white/15 text-snow/70 hover:border-white/40 hover:text-snow'}`}>
      <Icon name={running ? 'stop' : 'play'} className="h-3 w-3" />
      {running ? <Clock startedAt={t.timer.started_at} className="text-pink" /> : <span>Start</span>}
    </button>
  )
}

/* Floating bar: shows what you are tracking right now, on every page. */
function TimerBar({ toast, dismiss }) {
  const t = useTimer()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] grid justify-items-center gap-2 px-4">
      {toast && (
        <button onClick={dismiss} role="status" className={`pointer-events-auto max-w-lg rounded-2xl border px-4 py-2.5 text-left text-sm shadow-xl backdrop-blur ${toast.bad ? 'border-pink/50 bg-pink/15 text-pink' : 'border-white/15 bg-[#0d0f2b]/95 text-snow/85'}`}>{toast.text}</button>
      )}
      {t.timer && (
        <div className="pointer-events-auto flex max-w-full items-center gap-4 rounded-full border border-pink/50 bg-[#0d0f2b]/95 py-2 pl-5 pr-2 shadow-2xl shadow-black/50 backdrop-blur">
          <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pink" /></span>
          <span className="min-w-0 max-w-[40vw] truncate text-sm text-snow/85">{t.timer.task_title}</span>
          <Clock startedAt={t.timer.started_at} className="text-sm font-semibold" />
          <button onClick={t.stop} disabled={t.busy} className="pill-white flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"><Icon name="stop" className="h-3.5 w-3.5" />Stop</button>
          <button onClick={t.discard} aria-label="Discard timer" title="Discard without logging" className="grid h-8 w-8 place-items-center rounded-full text-snow/50 hover:bg-white/10 hover:text-snow"><Icon name="x" className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  )
}
