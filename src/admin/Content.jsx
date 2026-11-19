import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { defaults, mergeContent } from '../lib/useSiteContent'
import { field, btnWhite, btnGhost, card, ErrorNote, PageHeader } from './ui'

const lbl = 'text-xs font-semibold uppercase tracking-[0.16em] text-snow/45'
const inp = `${field} mt-2 text-base normal-case tracking-normal`

function Section({ title, hint, children, onSave, onReset, state }) {
  return (
    <section className={`${card} p-6 md:p-8`}>
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
      <label className={lbl}>{titleLabel} {i + 1}
        <input value={t} onChange={(e) => onChange(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} className={inp} />
      </label>
      <label className={lbl}>Description
        <textarea value={d} rows={2} onChange={(e) => onChange(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))} className={`${inp} resize-none`} />
      </label>
    </div>
  ))
}

export default function Content() {
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

  if (error) return <ErrorNote error={error} />
  if (!content) return <p className="text-snow/55">Loading...</p>
  const h = content.hero

  return (
    <div>
      <PageHeader title="Site content" sub="Edit the text on your public website. Changes go live as soon as you save." />
      <div className="grid gap-6">
        <Section title="Hero" hint="The first thing visitors read." state={state.hero} onSave={() => save('hero')} onReset={() => reset('hero')}>
          <label className={lbl}>Headline, line 1<input value={h.line1} onChange={(e) => set('hero')({ ...h, line1: e.target.value })} className={inp} /></label>
          <label className={lbl}>Headline, line 2<input value={h.line2} onChange={(e) => set('hero')({ ...h, line2: e.target.value })} className={inp} /></label>
          <label className={lbl}>Paragraph<textarea value={h.text} rows={3} onChange={(e) => set('hero')({ ...h, text: e.target.value })} className={`${inp} resize-none`} /></label>
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
    </div>
  )
}
