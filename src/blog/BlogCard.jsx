import { fmtLong } from '../lib/blog'

// A calm gradient stands in when a post has no cover image.
export function Cover({ post, className = '' }) {
  return post.cover_image
    ? <img src={post.cover_image} alt="" loading="lazy" className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${className}`} />
    : <div className={`h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(240,58,174,.45),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(47,123,255,.45),transparent_55%)] bg-ink-2 ${className}`} style={{ backgroundColor: '#0a0b24' }} />
}

export default function BlogCard({ post, featured = false }) {
  return (
    <a href={`/blog/${post.slug}`} className={`glass group block overflow-hidden rounded-3xl transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.06] ${featured ? 'md:grid md:grid-cols-[1.2fr_1fr]' : ''}`}>
      <div className={`overflow-hidden ${featured ? 'aspect-[16/10] md:aspect-auto md:min-h-[380px]' : 'aspect-[16/10]'}`}><Cover post={post} /></div>
      <div className={`flex flex-col p-6 md:p-8 ${featured ? 'justify-center' : ''}`}>
        <div className="flex flex-wrap items-center gap-3 text-xs text-snow/55">
          {post.category && <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-snow/80">{post.category}</span>}
          {post.published_at && <time dateTime={post.published_at}>{fmtLong(post.published_at)}</time>}
        </div>
        <h3 className={`mt-4 font-semibold leading-tight tracking-[-0.03em] ${featured ? 'text-3xl md:text-4xl' : 'text-2xl'}`}>{post.title}</h3>
        {post.excerpt && <p className="mt-3 line-clamp-3 leading-relaxed text-snow/65">{post.excerpt}</p>}
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-snow/90">Read article <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span></span>
      </div>
    </a>
  )
}
