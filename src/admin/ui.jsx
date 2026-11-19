import { useEffect, useRef } from 'react'

export const field = 'w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-base text-snow placeholder:text-snow/35 outline-none transition-colors focus:border-white/40'
export const label = 'block text-xs font-semibold uppercase tracking-[0.16em] text-snow/45'
export const btn = 'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0'
export const btnWhite = `${btn} pill-white`
export const btnGhost = `${btn} glass text-snow hover:bg-white/10`
export const card = 'glass rounded-3xl'

export const STATUSES = [
  ['open', 'Open', 'bg-snow/50'],
  ['in_progress', 'In progress', 'bg-violet'],
  ['blocked', 'Blocked', 'bg-pink'],
  ['done', 'Done', 'bg-emerald-400'],
]
export const statusLabel = Object.fromEntries(STATUSES.map(([k, l]) => [k, l]))
export const statusDot = Object.fromEntries(STATUSES.map(([k, , d]) => [k, d]))
export const PRIORITY = { high: 'bg-pink/20 text-pink', medium: 'bg-amber-400/20 text-amber-300', low: 'bg-white/10 text-snow/60' }
export const CATEGORIES = ['Website', 'Client', 'Marketing', 'Internal', 'Product']

const toIso = (d) => d.toLocaleDateString('en-CA')
export const todayStr = () => toIso(new Date())
export const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
export const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const isOverdue = (t) => !!t.due_date && t.status !== 'done' && t.due_date < todayStr()
export const dayKey = (iso) => toIso(new Date(iso))

const paths = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  folder: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />,
  inbox: <><path d="M3 13l3-8h12l3 8v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z" /><path d="M3 13h5l1 3h6l1-3h5" /></>,
  chart: <path d="M3 20h18M6 16v-5M11 16V6M16 16v-8M21 16v-3" />,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h4M9 13h6M9 17h6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  logout: <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  back: <path d="M15 5l-7 7 7 7" />,
  insights: <path d="M5 20V10M12 20V4M19 20v-7" />,
  pen: <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1zM14 7l3 3" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  comment: <path d="M4 5h16v11H9l-5 4V5z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 010 6.4M21.5 20c0-2.8-1.5-4.8-4-5.6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  refresh: <path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />,
}
export function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

const modalStack = []
export function Modal({ title, onClose, children, wide = false }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    // Escape closes only the top-most window, even when windows are stacked.
    const id = Symbol('modal')
    modalStack.push(id)
    const onKey = (e) => { if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) closeRef.current() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      modalStack.splice(modalStack.indexOf(id), 1)
      if (!modalStack.length) document.body.style.overflow = ''
    }
  }, [])
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-3xl border border-white/12 bg-[#0a0b22] p-6 shadow-2xl md:p-8`}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold tracking-[-0.03em]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-snow/60 hover:bg-white/10 hover:text-snow"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Ring({ pct, size = 96 }) {
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringg)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .6s' }} />
        <defs><linearGradient id="ringg" x1="0" x2="1"><stop offset="0" stopColor="#2f7bff" /><stop offset="1" stopColor="#f03aae" /></linearGradient></defs>
      </svg>
      <span className="absolute text-lg font-bold">{pct}%</span>
    </div>
  )
}

export function Bar({ pct, className = '' }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-sky to-pink transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  )
}

export const ErrorNote = ({ error }) => error ? <p role="alert" className="rounded-xl border border-pink/40 bg-pink/10 p-4 text-sm text-pink">{error}</p> : null

export function PageHeader({ title, sub, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl font-bold tracking-[-0.045em] md:text-5xl">{title}</h1>
        {sub && <p className="mt-2 text-snow/55">{sub}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

const AVATAR_GRADIENTS = ['from-sky to-violet', 'from-violet to-pink', 'from-sky to-pink', 'from-emerald-400 to-sky', 'from-amber-400 to-pink']
export function Avatar({ person, size = 'h-7 w-7', text = 'text-xs' }) {
  const name = person?.full_name || person?.email || person?.author_email || ''
  if (!name) {
    return <span title="Unassigned" className={`${size} grid shrink-0 place-items-center rounded-full border border-dashed border-white/25 text-snow/40`}><Icon name="users" className="h-3.5 w-3.5" /></span>
  }
  const key = person.email || person.author_email || name
  const hue = [...key].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_GRADIENTS.length
  return <span title={person.full_name ? `${person.full_name} (${key})` : key} className={`${size} ${text} grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[hue]} font-bold`}>{name[0].toUpperCase()}</span>
}
