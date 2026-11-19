import { esc, rest } from './_shared.js'

// Live sitemap: the home page, the blog index and every published post.
export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin
  let posts = []
  try {
    const now = encodeURIComponent(new Date().toISOString())
    posts = await rest(env, `blog_posts?select=slug,updated_at,published_at&status=eq.published&published_at=lte.${now}&order=published_at.desc&limit=1000`)
  } catch { /* serve the static pages even if the database is unreachable */ }

  const entry = (loc, lastmod, freq, priority) =>
    `  <url>\n    <loc>${esc(loc)}</loc>\n${lastmod ? `    <lastmod>${esc(lastmod.slice(0, 10))}</lastmod>\n` : ''}    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`

  const body = [
    entry(`${origin}/`, null, 'weekly', '1.0'),
    entry(`${origin}/blog`, posts[0]?.updated_at, 'weekly', '0.8'),
    ...posts.map((p) => entry(`${origin}/blog/${p.slug}`, p.updated_at || p.published_at, 'monthly', '0.7')),
  ].join('\n')

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  })
}
