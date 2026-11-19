import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useMeta } from '../lib/blog'
import { fmtStars } from '../lib/github'
import { startTracking } from '../lib/track'
import { wrap, Badge, Nav, Footer } from '../components/chrome'
import { resourceQuery } from './ResourceView'

export default function ResourceIndex() {
  const [items, setItems] = useState(null)
  const [tag, setTag] = useState('All')
  const [query, setQuery] = useState('')
  useMeta({ title: 'Resources | Digital Legends Agency', description: 'Open-source tools and repositories our team likes for building apps, with notes on where each one fits.' })
  useEffect(() => startTracking(), [])
  useEffect(() => {
    supabase.from('resources').select(resourceQuery.list).eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false })
      .then(({ data }) => setItems(data || []))
  }, [])

  const tags = useMemo(() => {
    const count = {}
    ;(items || []).forEach((r) => r.tags?.forEach((t) => { count[t] = (count[t] || 0) + 1 }))
    return ['All', ...Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t)]
  }, [items])
  const q = query.trim().toLowerCase()
  const shown = (items || []).filter((r) => (tag === 'All' || r.tags?.includes(tag)) && (!q || `${r.title} ${r.summary || ''} ${r.tags?.join(' ')}`.toLowerCase().includes(q)))

  return (
    <>
      <Nav home={false} />
      <main className="pt-36 md:pt-44">
        <div className={wrap}>
          <Badge>Resources</Badge>
          <h1 className="h-display mt-8 max-w-4xl text-[clamp(2.7rem,6.5vw,5.5rem)]">Tools worth knowing.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-snow/70">Open-source repositories and tools our team likes for building apps, with notes on where each one fits.</p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search resources" aria-label="Search resources" className="w-full max-w-xs rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm outline-none placeholder:text-snow/35 focus:border-white/40" />
            {tags.length > 2 && tags.map((t) => <button key={t} onClick={() => setTag(t)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${tag === t ? 'border-snow bg-snow text-ink' : 'border-white/15 text-snow/75 hover:border-white/40'}`}>{t}</button>)}
          </div>

          <div className="mt-10 pb-24">
            {items === null && <p className="text-snow/55">Loading...</p>}
            {items && !items.length && <p className="text-snow/60">No resources yet. Check back soon.</p>}
            {items && items.length > 0 && !shown.length && <p className="text-snow/60">Nothing matches your search.</p>}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {shown.map((r) => (
                <a key={r.id} href={`/resources/${r.slug}`} className="glass group flex flex-col rounded-3xl p-6 transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.06] md:p-7">
                  <div className="flex items-center justify-between gap-3 text-xs text-snow/55">
                    <span>{r.github_language || 'Resource'}</span>
                    {r.github_stars != null && <span className="flex items-center gap-1"><span aria-hidden="true">☆</span>{fmtStars(r.github_stars)}</span>}
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.03em]">{r.title}</h2>
                  {r.summary && <p className="mt-3 line-clamp-3 leading-relaxed text-snow/65">{r.summary}</p>}
                  <ul className="mt-5 flex flex-wrap gap-2">{r.tags?.slice(0, 4).map((t) => <li key={t} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-snow/70">{t}</li>)}</ul>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">View resource <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span></span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
