import { esc, rest } from '../_shared.js'

// Same idea as functions/blog/[slug].js: send search engines and link previews the resource's
// title, description, canonical link and structured data in the very first response.
export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url)
  const shell = () => env.ASSETS.fetch(new URL('/', url))
  try {
    const slug = String(params.slug || '')
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return shell()
    const now = encodeURIComponent(new Date().toISOString())
    const [r] = await rest(env, `resources?select=title,slug,summary,tags,github_url,github_language,published_at,updated_at&slug=eq.${encodeURIComponent(slug)}&status=eq.published&published_at=lte.${now}&limit=1`)
    const page = await shell()
    if (!r) return new Response(page.body, { status: 404, headers: page.headers })

    const canonical = `${url.origin}/resources/${r.slug}`
    const title = `${r.title} | Digital Legends Agency`
    const description = (r.summary || '').slice(0, 300)
    const ld = {
      '@context': 'https://schema.org', '@type': 'SoftwareSourceCode', name: r.title, description,
      ...(r.github_url && { codeRepository: r.github_url }),
      ...(r.github_language && { programmingLanguage: r.github_language }),
      ...(r.tags?.length && { keywords: r.tags.join(', ') }),
      datePublished: r.published_at, dateModified: r.updated_at || r.published_at, url: canonical,
      publisher: { '@type': 'Organization', name: 'Digital Legends Agency' },
    }
    const tags = [
      `<link rel="canonical" href="${esc(canonical)}">`,
      description && `<meta name="description" content="${esc(description)}">`,
      `<meta property="og:type" content="article">`,
      `<meta property="og:site_name" content="Digital Legends Agency">`,
      `<meta property="og:title" content="${esc(r.title)}">`,
      description && `<meta property="og:description" content="${esc(description)}">`,
      `<meta property="og:url" content="${esc(canonical)}">`,
      `<meta name="twitter:card" content="summary">`,
      `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    ].filter(Boolean).join('\n')

    return new HTMLRewriter()
      .on('title', { element(e) { e.setInnerContent(title) } })
      .on('meta[name="description"]', { element(e) { e.remove() } })
      .on('head', { element(e) { e.append(tags, { html: true }) } })
      .transform(page)
  } catch {
    return shell()
  }
}
