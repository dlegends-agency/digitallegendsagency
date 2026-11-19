import { esc, rest } from '../_shared.js'

// Serves the normal page, but with the article's title, description, share image, canonical link and
// structured data already in the HTML. Search engines and link previews (WhatsApp, LinkedIn, Facebook,
// X) do not run the site's JavaScript, so they need these tags in the first response.
export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url)
  const shell = () => env.ASSETS.fetch(new URL('/', url))
  try {
    const slug = String(params.slug || '')
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return shell()
    const now = encodeURIComponent(new Date().toISOString())
    const [post] = await rest(env, `blog_posts?select=title,slug,excerpt,seo_description,cover_image,category,author_name,published_at,updated_at&slug=eq.${encodeURIComponent(slug)}&status=eq.published&published_at=lte.${now}&limit=1`)
    const page = await shell()
    if (!post) return new Response(page.body, { status: 404, headers: page.headers })

    const origin = url.origin
    const canonical = `${origin}/blog/${post.slug}`
    const title = `${post.title} | Digital Legends Agency`
    const description = (post.seo_description || post.excerpt || '').slice(0, 300)
    const image = post.cover_image ? (/^https?:/i.test(post.cover_image) ? post.cover_image : origin + post.cover_image) : ''
    const ld = {
      '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description,
      ...(image && { image: [image] }),
      datePublished: post.published_at, dateModified: post.updated_at || post.published_at,
      author: { '@type': 'Person', name: post.author_name || 'Digital Legends Team' },
      publisher: { '@type': 'Organization', name: 'Digital Legends Agency', logo: { '@type': 'ImageObject', url: `${origin}/img/logo.webp` } },
      mainEntityOfPage: canonical,
      ...(post.category && { articleSection: post.category }),
    }
    const tags = [
      `<link rel="canonical" href="${esc(canonical)}">`,
      `<meta name="description" content="${esc(description)}">`,
      `<meta property="og:type" content="article">`,
      `<meta property="og:site_name" content="Digital Legends Agency">`,
      `<meta property="og:title" content="${esc(post.title)}">`,
      `<meta property="og:description" content="${esc(description)}">`,
      `<meta property="og:url" content="${esc(canonical)}">`,
      image && `<meta property="og:image" content="${esc(image)}">`,
      `<meta property="article:published_time" content="${esc(post.published_at)}">`,
      `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
      `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    ].filter(Boolean).join('\n')

    return new HTMLRewriter()
      .on('title', { element(e) { e.setInnerContent(title) } })
      .on('meta[name="description"]', { element(e) { e.remove() } })
      .on('head', { element(e) { e.append(tags, { html: true }) } })
      .transform(page)
  } catch {
    return shell() // never break the page because of a database or parsing problem
  }
}
