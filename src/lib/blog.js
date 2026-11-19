import { useEffect } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { supabase } from './supabase'

// Columns visitors are allowed to read (author_email stays private).
export const LIST_COLS = 'id,title,slug,excerpt,cover_image,category,tags,author_name,published_at'
export const POST_COLS = `${LIST_COLS},content,seo_description,updated_at`

export const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)
export const readingMinutes = (md = '') => Math.max(1, Math.round(md.trim().split(/\s+/).filter(Boolean).length / 220))
export const fmtLong = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

// Markdown is converted, then sanitized, so a post can never run scripts on the site.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') || '')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
  if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy')
})
export const renderMarkdown = (md) => DOMPurify.sanitize(marked.parse(md || '', { gfm: true, async: false }))

export async function listPublished(limit) {
  let q = supabase.from('blog_posts').select(LIST_COLS).eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false })
  if (limit) q = q.limit(limit)
  const { data, error } = await q
  return { data: data || [], error }
}
export async function getPublished(slug) {
  const { data, error } = await supabase.from('blog_posts').select(POST_COLS).eq('slug', slug).eq('status', 'published').lte('published_at', new Date().toISOString()).maybeSingle()
  return { data, error }
}

/* Sets the page title and share tags while a page is shown. */
export function useMeta({ title, description, image, type = 'website' }) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title
    const made = []
    const set = (attr, key, content) => {
      if (!content) return
      let el = document.head.querySelector(`meta[${attr}="${key}"]`)
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); made.push(el) }
      el.setAttribute('content', content)
    }
    set('name', 'description', description)
    set('property', 'og:title', title)
    set('property', 'og:description', description)
    set('property', 'og:image', image)
    set('property', 'og:type', type)
    set('name', 'twitter:card', image ? 'summary_large_image' : 'summary')
    return () => { document.title = prevTitle; made.forEach((m) => m.remove()) }
  }, [title, description, image, type])
}
