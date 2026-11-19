import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { field, label, btnWhite, btnGhost, card, fmtDate, Icon, ErrorNote, PageHeader } from './ui'
import { slugify, readingMinutes, renderMarkdown } from '../lib/blog'

const needsSetup = (m) => /schema cache|does not exist|permission denied|42501|PGRST205|bucket/i.test(m || '')
const friendly = (m) => (needsSetup(m) ? 'The blog is not set up yet. Run the latest supabase/schema.sql in the Supabase SQL Editor, then refresh.' : m)
const LIST_COLS = 'id,title,slug,status,category,cover_image,published_at,created_at,updated_at,author_name,author_email'
const ctl = `${field} mt-2 py-2.5 text-sm normal-case tracking-normal`
const toLocalInput = (iso) => { const d = iso ? new Date(iso) : new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

/* ---------------- List ---------------- */
function PostList({ navigate }) {
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('blog_posts').select(LIST_COLS).order('created_at', { ascending: false })
    if (error) setError(friendly(error.message)); else setPosts(data)
  }, [])
  useEffect(() => { load() }, [load])

  const counts = useMemo(() => ({ all: posts?.length || 0, published: posts?.filter((p) => p.status === 'published').length || 0, draft: posts?.filter((p) => p.status === 'draft').length || 0 }), [posts])
  const q = query.trim().toLowerCase()
  const shown = (posts || []).filter((p) => (filter === 'all' || p.status === filter) && (!q || `${p.title} ${p.category || ''}`.toLowerCase().includes(q)))

  return (
    <div>
      <PageHeader title="Blog" sub="Write and publish articles. Published posts appear on your website under /blog.">
        <button onClick={() => navigate('#/blog/new')} className={btnWhite}><Icon name="plus" className="h-4 w-4" />New post</button>
      </PageHeader>
      <ErrorNote error={error} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {['all', 'published', 'draft'].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${filter === s ? 'border-snow bg-snow text-ink' : 'border-white/15 text-snow/75 hover:border-white/40'}`}>{s} <span className="opacity-60">{counts[s]}</span></button>
          ))}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search posts" aria-label="Search posts" className={`${field} w-full py-2.5 text-sm sm:max-w-xs`} />
      </div>

      {posts === null && !error && <p className="text-snow/55">Loading...</p>}
      {posts && !shown.length && <p className="text-snow/55">{posts.length ? 'No posts match.' : 'No posts yet. Click New post to write your first article.'}</p>}

      <ul className="grid gap-3">
        {shown.map((p) => (
          <li key={p.id} className={`${card} flex flex-wrap items-center gap-4 p-4`}>
            <button onClick={() => navigate(`#/blog/${p.id}`)} className="flex min-w-0 flex-1 basis-72 items-center gap-4 text-left">
              <span className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-white/[0.05]">{p.cover_image && <img src={p.cover_image} alt="" className="h-full w-full object-cover" />}</span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-semibold tracking-[-0.02em]">{p.title}</span>
                <span className="block truncate text-xs text-snow/50">/{p.slug}{p.category ? ` · ${p.category}` : ''} · {p.author_name || p.author_email}</span>
              </span>
            </button>
            <span className="text-xs text-snow/50">{p.status === 'published' ? `Published ${fmtDate(p.published_at.slice(0, 10))}` : `Edited ${fmtDate(p.updated_at.slice(0, 10))}`}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${p.status === 'published' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-snow/60'}`}>{p.status}</span>
            {p.status === 'published' && <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="text-snow/55 hover:text-snow" aria-label="View live" title="View live"><Icon name="external" className="h-4 w-4" /></a>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------- Editor ---------------- */
const blank = { title: '', slug: '', excerpt: '', content: '', cover_image: '', category: '', tags: '', seo_description: '', status: 'draft', published_at: null }

function PostEditor({ id, navigate, me }) {
  const isNew = id === 'new'
  const [post, setPost] = useState(isNew ? blank : null)
  const [saved, setSaved] = useState(JSON.stringify(blank))
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState('write')
  const [cats, setCats] = useState([])
  const [pubAt, setPubAt] = useState(toLocalInput())
  const ta = useRef(null)
  const imgInput = useRef(null)

  useEffect(() => {
    supabase.from('blog_posts').select('category').not('category', 'is', null).then(({ data }) => setCats([...new Set((data || []).map((r) => r.category))]))
    if (isNew) return
    supabase.from('blog_posts').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error) { setError(friendly(error.message)); return }
      if (!data) { setPost(false); return }
      const p = { ...data, tags: (data.tags || []).join(', '), excerpt: data.excerpt || '', cover_image: data.cover_image || '', category: data.category || '', seo_description: data.seo_description || '' }
      setPost(p); setSaved(JSON.stringify(p)); setSlugTouched(true)
      if (data.published_at) setPubAt(toLocalInput(data.published_at))
    })
  }, [id, isNew])

  const dirty = post && JSON.stringify(post) !== saved
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = (patch) => setPost((p) => ({ ...p, ...patch }))
  const setTitle = (title) => set(slugTouched ? { title } : { title, slug: slugify(title) })

  async function save(nextStatus) {
    const p = post
    if (!p.title.trim()) { setError('Add a title first.'); return }
    if (!p.slug.trim()) { setError('The URL slug cannot be empty.'); return }
    const status = nextStatus || p.status
    const when = status === 'published' ? (p.status === 'published' && p.published_at && !pubAtChanged() ? p.published_at : new Date(pubAt).toISOString()) : p.published_at
    const row = {
      title: p.title.trim(), slug: slugify(p.slug), excerpt: p.excerpt.trim() || null, content: p.content,
      cover_image: p.cover_image.trim() || null, category: p.category.trim() || null,
      tags: p.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12),
      seo_description: p.seo_description.trim() || null, status, published_at: status === 'published' ? when : null,
      author_name: p.author_name || me.user_metadata?.full_name || me.email.split('@')[0],
    }
    setBusy(true); setError(''); setNote('')
    const q = isNew ? supabase.from('blog_posts').insert(row).select().single() : supabase.from('blog_posts').update(row).eq('id', id).select().single()
    const { data, error } = await q
    setBusy(false)
    if (error) { setError(/duplicate|unique|23505/i.test(error.message) ? 'That URL slug is already used by another post. Change the slug.' : friendly(error.message)); return }
    const next = { ...data, tags: (data.tags || []).join(', '), excerpt: data.excerpt || '', cover_image: data.cover_image || '', category: data.category || '', seo_description: data.seo_description || '' }
    setPost(next); setSaved(JSON.stringify(next))
    setNote(status === 'published' ? 'Published.' : 'Saved.')
    if (isNew) navigate(`#/blog/${data.id}`)
  }
  const pubAtChanged = () => !post.published_at || toLocalInput(post.published_at) !== pubAt

  async function remove() {
    if (!window.confirm('Delete this post permanently?')) return
    const { error } = await supabase.from('blog_posts').delete().eq('id', id)
    if (error) setError(friendly(error.message)); else { setSaved(JSON.stringify(post)); navigate('#/blog') }
  }

  /* ---- images ---- */
  async function upload(file) {
    if (!file) return null
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) { setError('Use a JPG, PNG, WebP, GIF or AVIF image.'); return null }
    if (file.size > 5 * 1024 * 1024) { setError('Images must be 5 MB or smaller.'); return null }
    setUploading(true); setError('')
    const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '')
    const path = `${new Date().getFullYear()}/${crypto.randomUUID().slice(0, 8)}-${safe}`
    const { error } = await supabase.storage.from('blog-images').upload(path, file, { contentType: file.type })
    setUploading(false)
    if (error) { setError(friendly(error.message)); return null }
    return supabase.storage.from('blog-images').getPublicUrl(path).data.publicUrl
  }
  async function pickCover(e) { const url = await upload(e.target.files[0]); e.target.value = ''; if (url) set({ cover_image: url }) }
  async function insertImage(e) {
    const file = e.target.files[0]; e.target.value = ''
    const url = await upload(file)
    if (url) wrapText(`

![${file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')}](`, `${url})

`, '')
  }

  /* ---- markdown toolbar ---- */
  function wrapText(before, after, placeholder) {
    const el = ta.current
    const { selectionStart: a, selectionEnd: b, value } = el
    const chosen = value.slice(a, b) || placeholder
    const next = value.slice(0, a) + before + chosen + after + value.slice(b)
    set({ content: next })
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + chosen.length) })
  }
  function linePrefix(prefix) {
    const el = ta.current
    const { selectionStart: a, value } = el
    const start = value.lastIndexOf('\n', a - 1) + 1
    set({ content: value.slice(0, start) + prefix + value.slice(start) })
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + prefix.length, a + prefix.length) })
  }
  const tools = [
    ['H2', () => linePrefix('## '), 'Heading'], ['H3', () => linePrefix('### '), 'Subheading'],
    ['B', () => wrapText('**', '**', 'bold text'), 'Bold'], ['I', () => wrapText('_', '_', 'italic text'), 'Italic'],
    ['Link', () => wrapText('[', '](https://)', 'link text'), 'Link'], ['•', () => linePrefix('- '), 'Bullet list'],
    ['1.', () => linePrefix('1. '), 'Numbered list'], ['❝', () => linePrefix('> '), 'Quote'], ['</>', () => wrapText('`', '`', 'code'), 'Code'],
  ]

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (post && !busy) save() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (post === null) return <p className="text-snow/55">{error ? <ErrorNote error={error} /> : 'Loading...'}</p>
  if (post === false) return <div><p className="text-snow/70">Post not found.</p><button onClick={() => navigate('#/blog')} className={`${btnGhost} mt-4`}>Back to Blog</button></div>

  const live = post.status === 'published'
  const preview = renderMarkdown(post.content)
  const words = post.content.trim() ? post.content.trim().split(/\s+/).length : 0

  return (
    <div>
      <div className="sticky top-0 z-30 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-ink/90 px-4 py-3 backdrop-blur md:-mx-10 md:px-10 lg:top-0">
        <div className="flex items-center gap-3">
          <button onClick={() => { if (!dirty || window.confirm('Leave without saving your changes?')) navigate('#/blog') }} className="inline-flex items-center gap-2 text-sm text-snow/65 hover:text-snow"><Icon name="back" className="h-4 w-4" />Blog</button>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${live ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-snow/60'}`}>{live ? 'Published' : 'Draft'}</span>
          <span className="text-xs text-snow/45">{dirty ? 'Unsaved changes' : note}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && live && <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className={btnGhost}><Icon name="external" className="h-4 w-4" />View live</a>}
          {live && <button disabled={busy} onClick={() => save('draft')} className={btnGhost}>Unpublish</button>}
          {!live && <button disabled={busy} onClick={() => save('draft')} className={btnGhost}>Save draft</button>}
          <button disabled={busy} onClick={() => save('published')} className={btnWhite}>{busy ? 'Saving...' : live ? 'Update' : 'Publish'}</button>
        </div>
      </div>

      <ErrorNote error={error} />

      <div className="mt-2 grid items-start gap-8 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <input value={post.title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Post title" aria-label="Post title"
            className="w-full rounded-xl border border-transparent bg-transparent px-1 py-1 text-4xl font-bold tracking-[-0.04em] outline-none placeholder:text-snow/25 hover:border-white/10 focus:border-white/30 md:text-5xl" />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Formatting">
              {tools.map(([t, fn, name]) => <button key={t} type="button" onClick={fn} title={name} aria-label={name} className="min-w-9 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-snow/75 hover:bg-white/10 hover:text-snow">{t}</button>)}
              <button type="button" onClick={() => imgInput.current.click()} disabled={uploading} title="Insert image" aria-label="Insert image" className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-snow/75 hover:bg-white/10 hover:text-snow disabled:opacity-50">{uploading ? 'Uploading...' : 'Image'}</button>
              <input ref={imgInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={insertImage} className="hidden" />
            </div>
            <div className="glass flex rounded-full p-1 text-sm font-semibold">
              {[['write', 'Write'], ['preview', 'Preview']].map(([k, l]) => <button key={k} onClick={() => setMode(k)} className={`rounded-full px-4 py-1.5 ${mode === k ? 'bg-snow text-ink' : 'text-snow/65'}`}>{l}</button>)}
            </div>
          </div>

          {mode === 'write' ? (
            <textarea ref={ta} value={post.content} onChange={(e) => set({ content: e.target.value })} aria-label="Post content"
              placeholder={'Write your article in Markdown.\n\n## A heading\nA paragraph with **bold** and a [link](https://example.com).'}
              className={`${field} mt-3 min-h-[560px] resize-y font-mono text-[15px] leading-relaxed`} />
          ) : (
            <div className={`${card} mt-3 min-h-[560px] p-6 md:p-10`}>
              <div className="mx-auto max-w-3xl">
                <h1 className="h-display text-4xl md:text-5xl">{post.title || 'Untitled'}</h1>
                <div className="prose-blog mt-8" dangerouslySetInnerHTML={{ __html: preview || '<p>Nothing to preview yet.</p>' }} />
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-snow/45">{words} words · about {readingMinutes(post.content)} min read · Ctrl+S to save</p>
        </div>

        <aside className="grid content-start gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 xl:sticky xl:top-24">
          <label className={label}>URL slug
            <input value={post.slug} onChange={(e) => { setSlugTouched(true); set({ slug: slugify(e.target.value) }) }} maxLength={120} className={ctl} />
            <span className="mt-1 block text-[11px] normal-case tracking-normal text-snow/40">/blog/{post.slug || '...'}</span>
          </label>
          <label className={label}>Excerpt
            <textarea value={post.excerpt} onChange={(e) => set({ excerpt: e.target.value })} rows={3} maxLength={400} placeholder="One or two sentences shown on the blog list" className={`${ctl} resize-none`} />
          </label>

          <div>
            <span className={label}>Cover image</span>
            {post.cover_image && <div className="mt-2 aspect-[16/9] overflow-hidden rounded-xl border border-white/10"><img src={post.cover_image} alt="" className="h-full w-full object-cover" /></div>}
            <div className="mt-2 flex flex-wrap gap-2">
              <label className={`${btnGhost} cursor-pointer text-xs`}>{uploading ? 'Uploading...' : post.cover_image ? 'Replace' : 'Upload image'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={pickCover} disabled={uploading} className="hidden" />
              </label>
              {post.cover_image && <button onClick={() => set({ cover_image: '' })} className="text-xs text-pink hover:underline">Remove</button>}
            </div>
            <input value={post.cover_image} onChange={(e) => set({ cover_image: e.target.value })} placeholder="or paste an image URL" aria-label="Cover image URL" className={`${ctl} text-xs`} />
          </div>

          <label className={label}>Category
            <input value={post.category} onChange={(e) => set({ category: e.target.value })} list="blog-cats" maxLength={60} placeholder="e.g. Guides" className={ctl} />
            <datalist id="blog-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className={label}>Tags
            <input value={post.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="ai, mobile, strategy" className={ctl} />
          </label>
          <label className={label}>SEO description
            <textarea value={post.seo_description} onChange={(e) => set({ seo_description: e.target.value })} rows={3} maxLength={200} placeholder="Shown in Google results. Up to 200 characters." className={`${ctl} resize-none`} />
            <span className="mt-1 block text-[11px] normal-case tracking-normal text-snow/40">{post.seo_description.length}/200</span>
          </label>
          <label className={label}>Publish date
            <input type="datetime-local" value={pubAt} onChange={(e) => setPubAt(e.target.value)} className={ctl} />
            <span className="mt-1 block text-[11px] normal-case tracking-normal text-snow/40">Pick a future date to schedule the post.</span>
          </label>

          {!isNew && <button onClick={remove} className="justify-self-start text-sm text-pink hover:underline">Delete post</button>}
        </aside>
      </div>
    </div>
  )
}

export default function Blog({ seg, navigate, me }) {
  return seg[1] ? <PostEditor id={seg[1]} key={seg[1]} navigate={navigate} me={me} /> : <PostList navigate={navigate} />
}
