import { useEffect, useMemo, useState } from 'react'
import { getPublished, listPublished, renderMarkdown, readingMinutes, fmtLong, useMeta } from '../lib/blog'
import { startTracking } from '../lib/track'
import { wrap, Nav, Footer } from '../components/chrome'
import BlogCard from './BlogCard'

export default function BlogPost({ slug }) {
  const [post, setPost] = useState(undefined)
  const [more, setMore] = useState([])

  useEffect(() => startTracking(), [])
  useEffect(() => {
    getPublished(slug).then(({ data }) => setPost(data || null))
    listPublished(4).then(({ data }) => setMore(data.filter((p) => p.slug !== slug).slice(0, 3)))
  }, [slug])

  useMeta({
    title: post ? `${post.title} | Digital Legends Agency` : 'Blog | Digital Legends Agency',
    description: post ? (post.seo_description || post.excerpt || '') : '',
    image: post?.cover_image, type: post ? 'article' : 'website',
  })
  const html = useMemo(() => renderMarkdown(post?.content), [post])

  return (
    <>
      <Nav home={false} />
      <main className="pt-36 md:pt-44">
        {post === undefined && <div className={`${wrap} min-h-[60vh] text-snow/55`}>Loading...</div>}

        {post === null && (
          <div className={`${wrap} min-h-[60vh]`}>
            <h1 className="h-display text-5xl">Article not found</h1>
            <p className="mt-4 max-w-md text-snow/65">This article may have been moved or is not published yet.</p>
            <a href="/blog" className="pill-white mt-8 inline-block rounded-full px-7 py-3.5 text-[15px] font-semibold">Back to the blog</a>
          </div>
        )}

        {post && (
          <>
            <article>
              <div className="mx-auto w-full max-w-3xl px-6">
                <a href="/blog" className="text-sm text-snow/60 hover:text-snow">← All articles</a>
                <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-snow/55">
                  {post.category && <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-snow/85">{post.category}</span>}
                  <time dateTime={post.published_at}>{fmtLong(post.published_at)}</time>
                  <span aria-hidden="true">·</span><span>{readingMinutes(post.content)} min read</span>
                </div>
                <h1 className="h-display mt-5 text-[clamp(2.4rem,5.5vw,4.2rem)]">{post.title}</h1>
                {post.excerpt && <p className="mt-6 text-xl leading-relaxed text-snow/70">{post.excerpt}</p>}
                {post.author_name && <p className="mt-6 text-sm text-snow/55">By <span className="font-semibold text-snow/85">{post.author_name}</span></p>}
              </div>

              {post.cover_image && (
                <div className={`${wrap} mt-12`}>
                  <div className="mx-auto aspect-[16/8] max-w-5xl overflow-hidden rounded-[2rem] border border-white/10">
                    <img src={post.cover_image} alt="" className="h-full w-full object-cover" />
                  </div>
                </div>
              )}

              <div className="mx-auto mt-12 w-full max-w-3xl px-6">
                <div className="prose-blog" dangerouslySetInnerHTML={{ __html: html }} />
                {post.tags?.length > 0 && (
                  <ul className="mt-12 flex flex-wrap gap-2 border-t border-white/10 pt-8">
                    {post.tags.map((t) => <li key={t} className="rounded-full bg-white/10 px-3 py-1 text-xs text-snow/70">{t}</li>)}
                  </ul>
                )}
              </div>
            </article>

            <section className={`${wrap} mt-20`}>
              <div className="glass rounded-[2rem] p-8 text-center md:p-14">
                <h2 className="h-section text-[clamp(1.8rem,4vw,3rem)]">Got a niche? Let's build for it.</h2>
                <p className="mx-auto mt-4 max-w-md text-snow/65">Tell us about your project and who it is for.</p>
                <a href="/#contact" className="pill-white mt-7 inline-block rounded-full px-7 py-3.5 text-[15px] font-semibold">Start a project</a>
              </div>
            </section>

            {more.length > 0 && (
              <section className={`${wrap} mt-20`}>
                <h2 className="h-section text-3xl">Keep reading</h2>
                <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{more.map((p) => <BlogCard key={p.id} post={p} />)}</div>
              </section>
            )}
            <div className="pb-24" />
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
