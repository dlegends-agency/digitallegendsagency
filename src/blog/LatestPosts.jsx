import { useEffect, useState } from 'react'
import { listPublished } from '../lib/blog'
import { wrap, Badge } from '../components/chrome'
import { Reveal, Words } from '../components/motion'
import BlogCard from './BlogCard'

/* Homepage section. Renders nothing until at least one post is published. */
export default function LatestPosts() {
  const [posts, setPosts] = useState([])
  useEffect(() => {
    let live = true
    listPublished(3).then(({ data }) => { if (live) setPosts(data) })
    return () => { live = false }
  }, [])
  if (!posts.length) return null
  return (
    <section id="blog" className="py-20 md:py-28">
      <div className={wrap}>
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Badge>Blog</Badge>
            <h2 className="h-section mt-7 text-[clamp(2.3rem,5vw,4.4rem)]"><Words text="Latest articles." /></h2>
          </div>
          <a href="/blog" className="glass rounded-full px-6 py-3 text-[15px] font-semibold hover:bg-white/10">All articles</a>
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p, i) => <Reveal key={p.id} delay={i * 0.07}><BlogCard post={p} /></Reveal>)}
        </div>
      </div>
    </section>
  )
}
