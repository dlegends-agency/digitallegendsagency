import { useEffect, useMemo, useState } from 'react'
import { listPublished, useMeta } from '../lib/blog'
import { startTracking } from '../lib/track'
import { wrap, Badge, Nav, Footer } from '../components/chrome'
import BlogCard from './BlogCard'

export default function BlogIndex() {
  const [posts, setPosts] = useState(null)
  const [cat, setCat] = useState('All')
  useMeta({ title: 'Blog | Digital Legends Agency', description: 'Articles from Digital Legends Agency on building AI-powered mobile apps for niche markets.' })
  useEffect(() => startTracking(), [])
  useEffect(() => { listPublished().then(({ data }) => setPosts(data)) }, [])

  const cats = useMemo(() => ['All', ...new Set((posts || []).map((p) => p.category).filter(Boolean))], [posts])
  const shown = (posts || []).filter((p) => cat === 'All' || p.category === cat)
  const [first, ...rest] = shown

  return (
    <>
      <Nav home={false} />
      <main className="pt-36 md:pt-44">
        <div className={wrap}>
          <Badge>Blog</Badge>
          <h1 className="h-display mt-8 max-w-4xl text-[clamp(2.7rem,6.5vw,5.5rem)]">Ideas for niche apps.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-snow/70">Guides and notes from the Digital Legends team on building apps for specialized audiences.</p>

          {cats.length > 2 && (
            <div className="mt-10 flex flex-wrap gap-2">
              {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${cat === c ? 'border-snow bg-snow text-ink' : 'border-white/15 text-snow/75 hover:border-white/40'}`}>{c}</button>)}
            </div>
          )}

          <div className="mt-12 pb-24">
            {posts === null && <p className="text-snow/55">Loading...</p>}
            {posts && !posts.length && <p className="text-snow/60">No articles yet. Check back soon.</p>}
            {first && <BlogCard post={first} featured />}
            {rest.length > 0 && <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{rest.map((p) => <BlogCard key={p.id} post={p} />)}</div>}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
