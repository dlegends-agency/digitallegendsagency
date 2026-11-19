import { supabase } from './supabase'

// Cookie-free, IP-free analytics. One random id per browsing session (sessionStorage), nothing else about the visitor.
const OPT_OUT_KEY = 'dl_no_track'

export const isOptedOut = () => { try { return localStorage.getItem(OPT_OUT_KEY) === '1' } catch { return false } }
export const setOptOut = (on) => { try { on ? localStorage.setItem(OPT_OUT_KEY, '1') : localStorage.removeItem(OPT_OUT_KEY) } catch { /* ignore */ } }

function sessionId() {
  try {
    let id = sessionStorage.getItem('dl_sid')
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('dl_sid', id) }
    return id
  } catch { return 'nosession' }
}

const device = () => (innerWidth < 768 ? 'mobile' : innerWidth < 1100 ? 'tablet' : 'desktop')

function referrerHost() {
  try {
    if (!document.referrer) return null
    const h = new URL(document.referrer).hostname
    return h === location.hostname ? null : h.slice(0, 200)
  } catch { return null }
}

export function track(type, label = null) {
  if (isOptedOut() || navigator.webdriver) return
  const q = new URLSearchParams(location.search)
  const row = { session_id: sessionId(), type, path: location.pathname.slice(0, 300), label: label && String(label).slice(0, 200), device: device() }
  if (type === 'pageview') {
    row.referrer = referrerHost()
    row.utm_source = q.get('utm_source')?.slice(0, 100) || null
    row.utm_medium = q.get('utm_medium')?.slice(0, 100) || null
    row.utm_campaign = q.get('utm_campaign')?.slice(0, 100) || null
  }
  supabase.from('analytics_events').insert(row).then(() => {}, () => {})
}

/* Starts tracking for the public site: page view, section views, outbound and CTA clicks. Returns a cleanup. */
let lastPageview = 0
export function startTracking() {
  // React StrictMode runs effects twice in development; count one page view per load.
  if (Date.now() - lastPageview > 1500) { lastPageview = Date.now(); track('pageview') }
  const seen = new Set()
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && !seen.has(e.target.id)) { seen.add(e.target.id); track('section', e.target.id) }
    }
  }, { threshold: 0.35 })
  ;['services', 'approach', 'principles', 'contact'].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el) })

  const onClick = (e) => {
    const a = e.target.closest?.('a[href]')
    if (!a) return
    const href = a.getAttribute('href')
    if (href === '#contact') track('cta_click', a.textContent.trim() || 'Contact')
    else if (/^https?:/i.test(href)) {
      try { if (new URL(href).hostname !== location.hostname) track('click_out', new URL(href).hostname) } catch { /* ignore */ }
    }
  }
  document.addEventListener('click', onClick)
  return () => { io.disconnect(); document.removeEventListener('click', onClick) }
}
