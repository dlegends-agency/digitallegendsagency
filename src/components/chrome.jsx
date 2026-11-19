import { useState } from 'react'
import { nav, socials } from '../content'

export const wrap = 'mx-auto w-full max-w-[1440px] px-6 md:px-10'

export function Badge({ children }) {
  return (
    <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-snow/85">
      <span className="h-1.5 w-1.5 rounded-full bg-pink" />{children}
    </span>
  )
}

export function Button({ href, children, variant = 'white', className = '' }) {
  const base = 'inline-flex items-center justify-center rounded-full px-7 py-3.5 text-[15px] font-semibold transition-transform duration-300 hover:-translate-y-0.5'
  const v = variant === 'white' ? 'pill-white shadow-[0_8px_30px_-8px_rgba(255,255,255,.35)]' : 'glass text-snow hover:bg-white/10'
  return <a href={href} className={`${base} ${v} ${className}`}>{children}</a>
}

/* ---------------- Nav: floating pill ---------------- */
// On the home page, section links are in-page anchors. Elsewhere they point back to the home page.
export function Nav({ home = true }) {
  const [open, setOpen] = useState(false)
  const base = home ? '' : '/'
  const href = (h) => (h.startsWith('/') ? h : `${base}${h}`)
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 md:px-6">
      <div className="glass mx-auto flex max-w-[1440px] items-center justify-between rounded-full bg-ink/70 py-2.5 pl-6 pr-2.5 backdrop-blur-xl">
        <a href={`${base}#top`} aria-label="Digital Legends Agency home"><img src="/img/logo.webp" alt="Digital Legends Agency" className="h-9 w-auto md:h-11" /></a>
        <nav className="hidden items-center gap-9 md:flex" aria-label="Main">
          {nav.map(([l, h]) => <a key={l} href={href(h)} className="text-[15px] text-snow/70 transition-colors hover:text-snow">{l}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <a href={`${base}#contact`} className="pill-white rounded-full px-5 py-2.5 text-[14px] font-semibold">Start a project</a>
          <button aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)} className="glass grid h-10 w-10 place-items-center rounded-full md:hidden">
            <span className="grid gap-1"><span className="block h-0.5 w-4 bg-snow" /><span className="block h-0.5 w-4 bg-snow" /></span>
          </button>
        </div>
      </div>
      {open && (
        <div className="glass mx-auto mt-2 max-w-[1440px] rounded-3xl bg-ink/90 p-4 backdrop-blur-xl md:hidden">
          {nav.map(([l, h]) => <a key={l} href={href(h)} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-lg">{l}</a>)}
        </div>
      )}
    </header>
  )
}

/* ---------------- Footer ---------------- */
export function Footer() {
  const site = 'https://digitallegendsagency.com'
  const links = [['About us', '/about-us/'], ['FAQ', '/faq/'], ['Privacy policy', '/privacy-policy/'], ['Terms', '/terms-and-conditions/']]
  return (
    <footer className="border-t border-white/10">
      <div className={`${wrap} grid gap-10 py-14 md:grid-cols-[1.6fr_1fr_1fr]`}>
        <div>
          <img src="/img/logo.webp" alt="Digital Legends Agency" className="h-11 w-auto" />
          <p className="mt-5 max-w-xs text-snow/60">Mobile apps for niche markets. Built with AI.</p>
        </div>
        <ul className="space-y-3 text-snow/70">
          <li><a className="transition-colors hover:text-snow" href="/blog">Blog</a></li>
          {links.map(([l, p]) => <li key={l}><a className="transition-colors hover:text-snow" href={site + p} target="_blank" rel="noreferrer">{l}</a></li>)}
        </ul>
        <ul className="space-y-3 text-snow/70">
          {socials.map(([l, h]) => <li key={l}><a className="transition-colors hover:text-snow" href={h} target="_blank" rel="noreferrer">{l}</a></li>)}
        </ul>
      </div>
      <div className="border-t border-white/10 py-6 text-center text-sm text-snow/40">© {new Date().getFullYear()} Digital Legends Agency</div>
    </footer>
  )
}
