import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { field, label, btnWhite, btnGhost, card, fmtDate, fmtDateTime, Icon, ErrorNote, PageHeader } from './ui'
import { slugify, readingMinutes } from '../lib/blog'
import { fetchRepo, draftFrom, parseRepo, fmtStars } from '../lib/github'
import ResourceView from '../blog/ResourceView'

const needsSetup = (m) => /schema cache|does not exist|permission denied|42501|PGRST205/i.test(m || '')
const friendly = (m) => (needsSetup(m) ? 'Resources are not set up yet. Run the latest supabase/schema.sql in the Supabase SQL Editor, then refresh.' : m)
const COLS = 'id,title,slug,status,summary,tags,github_url,github_stars,github_language,published_at,updated_at'
const ctl = `${field} mt-2 py-2.5 text-sm normal-case tracking-normal`

/* ---------------- List ---------------- */
function ResourceList({ navigate }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('resources').select(COLS).order('updated_at', { ascending: false })
    if (error) setError(friendly(error.message)); else setItems(data)
  }, [])
  useEffect(() => { load() }, [load])

  const counts = useMemo(() => ({ all: items?.length || 0, published: items?.filter((p) => p.status === 'published').length || 0, draft: items?.filter((p) => p.status === 'draft').length || 0 }), [items])
  const q = query.trim().toLowerCase()
  const shown = (items || []).filter((r) => (filter === 'all' || r.status === filter) && (!q || `${r.title} ${r.summary || ''} ${r.tags?.join(' ')}`.toLowerCase().includes(q)))

  return (
    <div>
      <PageHeader title="Resources" sub="A curated list of tools and repositories. Published ones appear on your website under /resources.">
        <button onClick={() => navigate('#/resources/new')} className={btnWhite}><Icon name="plus" className="h-4 w-4" />Add resource</button>
      </PageHeader>
      <ErrorNote error={error} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {['all', 'published', 'draft'].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${filter === s ? 'border-snow bg-snow text-ink' : 'border-white/15 text-snow/75 hover:border-white/40'}`}>{s} <span className="opacity-60">{counts[s]}</span></button>
          ))}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search resources" aria-label="Search resources" className={`${field} max-w-xs py-2.5 text-sm`} />
      </div>

      {items === null && !error && <p className="text-snow/55">Loading...</p>}
      {items && !shown.length && <p className="text-snow/55">{items.length ? 'Nothing matches.' : 'No resources yet. Click Add resource and paste a GitHub link to start.'}</p>}

      <ul className="grid gap-3">
        {shown.map((r) => (
          <li key={r.id} className={`${card} flex flex-wrap items-center gap-4 p-4`}>
            <button onClick={() => navigate(`#/resources/${r.id}`)} className="min-w-0 flex-1 basis-72 text-left">
              <span className="block truncate text-lg font-semibold tracking-[-0.02em]">{r.title}</span>
              <span className="block truncate text-xs text-snow/50">/resources/{r.slug}{r.github_language ? ` · ${r.github_language}` : ''}{r.github_stars != null ? ` · ${fmtStars(r.github_stars)} stars` : ''}</span>
            </button>
            <ul className="hidden flex-wrap gap-1.5 md:flex">{r.tags?.slice(0, 3).map((t) => <li key={t} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-snow/65">{t}</li>)}</ul>
            <span className="text-xs text-snow/50">Saved {fmtDate(r.updated_at.slice(0, 10))}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${r.status === 'published' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-snow/60'}`}>{r.status}</span>
            {r.status === 'published' && <a href={`/resources/${r.slug}`} target="_blank" rel="noreferrer" className="text-snow/55 hover:text-snow" aria-label="View live" title="View live"><Icon name="external" className="h-4 w-4" /></a>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------- Editor ---------------- */
const blank = { title: '', slug: '', summary: '', tags: '', body: '', github_url: '', github_stars: null, github_language: null, github_license: null, github_updated_at: null, status: 'draft', published_at: null, updated_at: null }
const normalize = (d) => ({ ...d, tags: (d.tags || []).join(', '), summary: d.summary || '', github_url: d.github_url || '' })

function ResourceEditor({ id, navigate }) {
  const isNew = id === 'new'
  const [r, setR] = useState(isNew ? blank : null)
  const [saved, setSaved] = useState(JSON.stringify(blank))
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [fetching, setFetching] = useState(false)
  const ta = useRef(null)

  useEffect(() => {
    if (isNew) return
    supabase.from('resources').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error) { setError(friendly(error.message)); return }
      if (!data) { setR(false); return }
      const n = normalize(data)
      setR(n); setSaved(JSON.stringify(n)); setSlugTouched(true)
    })
  }, [id, isNew])

  const dirty = r && JSON.stringify(r) !== saved
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = (patch) => setR((p) => ({ ...p, ...patch }))

  /* Reads the repository. Always refreshes the GitHub details; only fills the other fields if they are empty. */
  async function fetchGithub() {
    setError(''); setNote('')
    if (!parseRepo(r.github_url)) { setError('Paste a GitHub repository link, like https://github.com/owner/repo'); return }
    setFetching(true)
    try {
      const info = await fetchRepo(r.github_url)
      const d = draftFrom(info)
      const patch = { github_url: info.htmlUrl, github_stars: info.stars, github_language: info.language, github_license: info.license, github_updated_at: info.pushedAt }
      if (!r.title.trim()) patch.title = d.title
      if (!r.slug.trim() && !slugTouched) patch.slug = d.slug
      if (!r.summary.trim()) patch.summary = d.summary
      if (!r.tags.trim()) patch.tags = d.tags.join(', ')
      if (!r.body.trim()) patch.body = d.body
      set(patch)
      setNote('Fetched from GitHub. Edit anything, then save.')
    } catch (e) { setError(e.message) } finally { setFetching(false) }
  }

  async function save(nextStatus) {
    if (!r.title.trim()) { setError('Add a title first.'); return }
    const slug = slugify(r.slug || r.title)
    if (!slug) { setError('The URL cannot be empty.'); return }
    const status = nextStatus || r.status
    const row = {
      title: r.title.trim(), slug, summary: r.summary.trim() || null, body: r.body,
      tags: r.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12),
      github_url: r.github_url.trim() || null, github_stars: r.github_stars, github_language: r.github_language, github_license: r.github_license, github_updated_at: r.github_updated_at,
      status, published_at: status === 'published' ? (r.published_at || new Date().toISOString()) : null,
    }
    setBusy(true); setError(''); setNote('')
    const q = isNew ? supabase.from('resources').insert(row).select().single() : supabase.from('resources').update(row).eq('id', id).select().single()
    const { data, error } = await q
    setBusy(false)
    if (error) { setError(/duplicate|unique|23505/i.test(error.message) ? 'That URL is already used by another resource. Change it.' : friendly(error.message)); return }
    const n = normalize(data)
    setR(n); setSaved(JSON.stringify(n))
    setNote(status === 'published' ? 'Published.' : 'Saved.')
    if (isNew) navigate(`#/resources/${data.id}`)
  }

  async function remove() {
    if (!window.confirm('Delete this resource permanently?')) return
    const { error } = await supabase.from('resources').delete().eq('id', id)
    if (error) setError(friendly(error.message)); else { setSaved(JSON.stringify(r)); navigate('#/resources') }
  }

  /* markdown toolbar */
  function wrapText(before, after, placeholder) {
    const el = ta.current
    const { selectionStart: a, selectionEnd: b, value } = el
    const chosen = value.slice(a, b) || placeholder
    set({ body: value.slice(0, a) + before + chosen + after + value.slice(b) })
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + chosen.length) })
  }
  function linePrefix(prefix) {
    const el = ta.current
    const { selectionStart: a, value } = el
    const start = value.lastIndexOf('\n', a - 1) + 1
    set({ body: value.slice(0, start) + prefix + value.slice(start) })
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + prefix.length, a + prefix.length) })
  }
  const tools = [
    ['H2', () => linePrefix('## '), 'Heading'], ['H3', () => linePrefix('### '), 'Subheading'],
    ['B', () => wrapText('**', '**', 'bold text'), 'Bold'], ['I', () => wrapText('_', '_', 'italic text'), 'Italic'],
    ['Link', () => wrapText('[', '](https://)', 'link text'), 'Link'], ['•', () => linePrefix('- '), 'Bullet list'],
    ['1.', () => linePrefix('1. '), 'Numbered list'], ['❝', () => linePrefix('> '), 'Quote'], ['</>', () => wrapText('`', '`', 'code'), 'Code'],
  ]

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (r && !busy) save() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (r === null) return <p className="text-snow/55">{error ? <ErrorNote error={error} /> : 'Loading...'}</p>
  if (r === false) return <div><p className="text-snow/70">Resource not found.</p><button onClick={() => navigate('#/resources')} className={`${btnGhost} mt-4`}>Back to Resources</button></div>

  const live = r.status === 'published'
  const preview = { ...r, tags: r.tags.split(',').map((t) => t.trim()).filter(Boolean), title: r.title }

  return (
    <div>
      <button onClick={() => { if (!dirty || window.confirm('Leave without saving your changes?')) navigate('#/resources') }} className="mb-4 inline-flex items-center gap-2 text-sm text-snow/65 hover:text-snow"><Icon name="back" className="h-4 w-4" />Resources</button>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-[-0.045em] md:text-5xl">{isNew ? 'Add resource' : 'Edit resource'}</h1>
          {r.title && <p className="mt-1 text-snow/55">{r.title}</p>}
          <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-snow/50">
            <span className={`rounded-full px-3 py-1 font-semibold ${live ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-snow/60'}`}>{live ? 'Published' : 'Draft'}</span>
            {r.updated_at && <span>Last saved {fmtDateTime(r.updated_at)}</span>}
            {dirty && <span className="text-amber-300">Unsaved changes</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && live && <a href={`/resources/${r.slug}`} target="_blank" rel="noreferrer" className={btnGhost}>View live <Icon name="external" className="h-4 w-4" /></a>}
          <button disabled={busy} onClick={() => save()} className={btnGhost}>{busy ? 'Saving...' : 'Save'}</button>
          {live ? <button disabled={busy} onClick={() => save('draft')} className={btnGhost}>Unpublish</button> : <button disabled={busy} onClick={() => save('published')} className={btnWhite}>Publish</button>}
        </div>
      </div>

      <ErrorNote error={error} />
      {note && !error && <p role="status" className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300">{note}</p>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className={`${card} grid gap-5 p-6 md:p-8`}>
          <label className={label}>Title
            <input value={r.title} onChange={(e) => set(slugTouched ? { title: e.target.value } : { title: e.target.value, slug: slugify(e.target.value) })} maxLength={200} className={ctl} />
          </label>
          <div>
            <span className={label}>URL</span>
            <div className="mt-2 flex">
              <span className="grid shrink-0 place-items-center rounded-l-xl border border-r-0 border-white/12 bg-white/[0.06] px-3 font-mono text-xs text-snow/55">/resources/</span>
              <input value={r.slug} onChange={(e) => { setSlugTouched(true); set({ slug: slugify(e.target.value) }) }} maxLength={120} aria-label="URL slug" className={`${field} rounded-l-none py-2.5 text-sm`} />
            </div>
            {live && <p className="mt-1.5 text-xs text-snow/45">Changing the URL of a published resource breaks links to it.</p>}
          </div>

          <div>
            <label htmlFor="gh" className={label}>GitHub repo URL</label>
            <div className="mt-2 flex gap-2">
              <input id="gh" value={r.github_url} onChange={(e) => set({ github_url: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchGithub() } }} placeholder="https://github.com/owner/repo" className={`${field} py-2.5 text-sm`} />
              <button type="button" onClick={fetchGithub} disabled={fetching} className={`${btnGhost} shrink-0`}><Icon name="refresh" className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />{fetching ? 'Fetching...' : 'Fetch'}</button>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-snow/45">Fetch reads the repo and drafts the tags, summary and body from its topics, description and README, so you only have to edit. Fetch again any time to refresh the stars and details.</p>
          </div>

          <label className={label}>Summary ({r.summary.length}/160, used as the Google description)
            <textarea value={r.summary} onChange={(e) => set({ summary: e.target.value })} maxLength={160} rows={3} className={`${ctl} resize-none`} />
          </label>
          <label className={label}>Tags (comma separated)
            <input value={r.tags} onChange={(e) => set({ tags: e.target.value })} className={ctl} />
          </label>

          <div>
            <p className={`${label} flex items-center justify-between`}><span>Body (Markdown)</span><span className="normal-case tracking-normal text-snow/45">{readingMinutes(r.body)} min read</span></p>
            <div className="mt-2 flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-white/12 bg-white/[0.04] px-2 py-1.5" role="toolbar" aria-label="Formatting">
              {tools.map(([t, fn, name]) => <button key={t} type="button" onClick={fn} title={name} aria-label={name} className="min-w-8 rounded-lg px-2 py-1 text-sm font-semibold text-snow/75 hover:bg-white/10 hover:text-snow">{t}</button>)}
            </div>
            <textarea ref={ta} value={r.body} onChange={(e) => set({ body: e.target.value })} aria-label="Body" rows={16} className={`${field} resize-y rounded-t-none font-mono text-[14px] leading-relaxed`} />
          </div>

          {!isNew && <button onClick={remove} className="flex items-center justify-center gap-2 rounded-xl border border-pink/40 bg-pink/5 py-3 text-sm font-semibold text-pink hover:bg-pink/10"><Icon name="trash" className="h-4 w-4" />Delete resource</button>}
        </section>

        <aside className="xl:sticky xl:top-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-snow/40">Live preview</p>
          <div className={`${card} p-6 md:p-8`}><ResourceView r={preview} preview /></div>
        </aside>
      </div>
    </div>
  )
}

export default function Resources({ seg, navigate }) {
  return seg[1] ? <ResourceEditor id={seg[1]} key={seg[1]} navigate={navigate} /> : <ResourceList navigate={navigate} />
}
