import { renderMarkdown } from '../lib/blog'
import { parseRepo, fmtStars, timeAgo } from '../lib/github'

export const resourceQuery = {
  list: 'id,title,slug,summary,tags,github_url,github_stars,github_language,github_license,github_updated_at,published_at',
  full: 'id,title,slug,summary,body,tags,github_url,github_stars,github_language,github_license,github_updated_at,published_at,updated_at',
}

function GithubMark({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-current`} aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 00-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 015.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0012 .5z" />
    </svg>
  )
}

/* Stats card for the linked GitHub repository. */
export function RepoCard({ r }) {
  if (!r.github_url) return null
  const p = parseRepo(r.github_url)
  const facts = [['Stars', fmtStars(r.github_stars)], ['Language', r.github_language || '–'], ['Licence', r.github_license || '–'], ['Updated', timeAgo(r.github_updated_at)]]
  return (
    <a href={r.github_url} target="_blank" rel="noopener noreferrer" className="glass group block rounded-2xl p-5 transition-colors hover:border-white/25 hover:bg-white/[0.06]">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/[0.05]"><GithubMark /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-snow/45">GitHub repo</p>
          <p className="truncate font-semibold">{p ? `${p.owner}/${p.repo}` : r.github_url}</p>
        </div>
        <span aria-hidden="true" className="text-pink transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {facts.map(([k, v]) => <div key={k}><dt className="text-xs text-snow/45">{k}</dt><dd className="mt-1 font-semibold">{v}</dd></div>)}
      </dl>
    </a>
  )
}

/* One resource, as shown on the site and in the admin live preview. */
export default function ResourceView({ r, preview = false }) {
  const html = renderMarkdown(r.body)
  return (
    <article>
      {r.tags?.length > 0 && <ul className="flex flex-wrap gap-2">{r.tags.map((t) => <li key={t} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-snow/80">{t}</li>)}</ul>}
      <h1 className={`h-display mt-5 ${preview ? 'text-4xl' : 'text-[clamp(2.4rem,5.5vw,4.2rem)]'}`}>{r.title || 'Untitled'}</h1>
      <div className="mt-8"><RepoCard r={r} /></div>
      <div className="prose-blog mt-8" dangerouslySetInnerHTML={{ __html: html || '<p>Nothing to preview yet.</p>' }} />
    </article>
  )
}
