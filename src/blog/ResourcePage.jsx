import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useMeta } from '../lib/blog'
import { startTracking } from '../lib/track'
import { wrap, Nav, Footer } from '../components/chrome'
import ResourceView, { resourceQuery } from './ResourceView'

export default function ResourcePage({ slug }) {
  const [r, setR] = useState(undefined)
  useEffect(() => startTracking(), [])
  useEffect(() => {
    supabase.from('resources').select(resourceQuery.full).eq('slug', slug).eq('status', 'published').lte('published_at', new Date().toISOString()).maybeSingle()
      .then(({ data }) => setR(data || null))
  }, [slug])
  useMeta({ title: r ? `${r.title} | Digital Legends Agency` : 'Resources | Digital Legends Agency', description: r?.summary || '', type: 'article' })

  return (
    <>
      <Nav home={false} />
      <main className="pt-36 md:pt-44">
        {r === undefined && <div className={`${wrap} min-h-[60vh] text-snow/55`}>Loading...</div>}
        {r === null && (
          <div className={`${wrap} min-h-[60vh]`}>
            <h1 className="h-display text-5xl">Resource not found</h1>
            <p className="mt-4 max-w-md text-snow/65">It may have been moved or is not published yet.</p>
            <a href="/resources" className="pill-white mt-8 inline-block rounded-full px-7 py-3.5 text-[15px] font-semibold">Back to resources</a>
          </div>
        )}
        {r && (
          <>
            <div className="mx-auto w-full max-w-3xl px-6">
              <a href="/resources" className="text-sm text-snow/60 hover:text-snow">← All resources</a>
              <div className="mt-8"><ResourceView r={r} /></div>
              {r.github_url && <a href={r.github_url} target="_blank" rel="noopener noreferrer" className="pill-white mt-10 inline-block rounded-full px-7 py-3.5 text-[15px] font-semibold">Open on GitHub ↗</a>}
            </div>
            <section className={`${wrap} mt-20 pb-24`}>
              <div className="glass rounded-[2rem] p-8 text-center md:p-14">
                <h2 className="h-section text-[clamp(1.8rem,4vw,3rem)]">Got a niche? Let's build for it.</h2>
                <p className="mx-auto mt-4 max-w-md text-snow/65">Tell us about your project and who it is for.</p>
                <a href="/#contact" className="pill-white mt-7 inline-block rounded-full px-7 py-3.5 text-[15px] font-semibold">Start a project</a>
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
