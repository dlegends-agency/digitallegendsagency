import { useState } from 'react'
import { motion } from 'framer-motion'
import Shader from './components/Shader'
import { Reveal, Words, Para, ScrollText, Parallax, Marquee, ease } from './components/motion'
import { nav, services, steps, principles, socials } from './content'

const wrap = 'mx-auto w-full max-w-[1440px] px-6 md:px-10'
function Badge({ children }) {
  return (
    <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-snow/85">
      <span className="h-1.5 w-1.5 rounded-full bg-pink" />{children}
    </span>
  )
}

function Button({ href, children, variant = 'white', className = '' }) {
  const base = 'inline-flex items-center justify-center rounded-full px-7 py-3.5 text-[15px] font-semibold transition-transform duration-300 hover:-translate-y-0.5'
  const v = variant === 'white' ? 'pill-white shadow-[0_8px_30px_-8px_rgba(255,255,255,.35)]' : 'glass text-snow hover:bg-white/10'
  return <a href={href} className={`${base} ${v} ${className}`}>{children}</a>
}

/* ---------------- Nav: floating pill ---------------- */
function Nav() {
  const [open, setOpen] = useState(false)
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 md:px-6">
      <div className="glass mx-auto flex max-w-[1440px] items-center justify-between rounded-full bg-ink/70 py-2.5 pl-6 pr-2.5 backdrop-blur-xl">
        <a href="#top" aria-label="Digital Legends Agency home"><img src="/img/logo.webp" alt="Digital Legends Agency" className="h-9 w-auto md:h-11" /></a>
        <nav className="hidden items-center gap-9 md:flex" aria-label="Main">
          {nav.map(([l, h]) => <a key={l} href={h} className="text-[15px] text-snow/70 transition-colors hover:text-snow">{l}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <a href="#contact" className="pill-white rounded-full px-5 py-2.5 text-[14px] font-semibold">Start a project</a>
          <button aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)} className="glass grid h-10 w-10 place-items-center rounded-full md:hidden">
            <span className="grid gap-1"><span className="block h-0.5 w-4 bg-snow" /><span className="block h-0.5 w-4 bg-snow" /></span>
          </button>
        </div>
      </div>
      {open && (
        <div className="glass mx-auto mt-2 max-w-[1440px] rounded-3xl bg-ink/90 p-4 backdrop-blur-xl md:hidden">
          {nav.map(([l, h]) => <a key={l} href={h} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-lg">{l}</a>)}
        </div>
      )}
    </header>
  )
}

/* ---------------- Hero ---------------- */
function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-28 pt-36 md:pb-40 md:pt-44">
      <Shader className="absolute inset-x-0 top-0 h-full opacity-90" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-ink" />
      <div className={`${wrap} relative text-center`}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}><Badge>Mobile app agency</Badge></motion.div>
        <h1 className="h-display mx-auto mt-8 max-w-5xl text-[clamp(2.7rem,7vw,6rem)]">
          <Words text="Apps for niche markets." when delay={0.15} />
          <span className="block text-snow/75"><Words text="Built with AI." when delay={0.55} /></span>
        </h1>
        <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease, delay: 0.2 }}
          className="mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-snow/75 md:text-lg">
          Digital Legends is a mobile app agency. We study a specialized audience, then design and build the product around it, from first idea to launch.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button href="#contact">Start a project</Button>
          <Button href="#services" variant="ghost">See our services</Button>
        </motion.div>
      </div>
    </section>
  )
}

/* ---------------- Statement ---------------- */
function Statement() {
  return (
    <section className="py-28 md:py-40">
      <div className={`${wrap} text-center`}>
        <Reveal><Badge>Studio</Badge></Reveal>
        <ScrollText className="h-section mx-auto mt-8 max-w-5xl text-[clamp(1.8rem,4vw,3.4rem)]" segments={[
          ['Most apps are made for everyone,', 0], ['which is why they fit no one.', 1],
          ['We start with a single niche, study the people in it, and build the app they were missing.', 0],
          ['AI handles the personalization, the busywork and the predictions.', 1],
        ]} />
      </div>
    </section>
  )
}

function StudioImage() {
  return (
    <section className="pb-20 md:pb-28">
      <div className={wrap}>
        <Reveal>
          <Parallax className="h-[360px] rounded-[2rem] border border-white/10 md:h-[620px] md:rounded-[2.5rem]">
            <img src="/img/team.jpg" alt="A team planning app screens around a wall of wireframes" className="h-full w-full object-cover" loading="lazy" />
          </Parallax>
        </Reveal>
      </div>
    </section>
  )
}

/* ---------------- Services ---------------- */
const icons = [
  <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></>,
  <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" /></>,
  <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>,
  <><path d="M5 3.5h10l4 4v13H5z" /><path d="M14 3.5v5h5M8.5 13h7M8.5 16.5h7" /></>,
  <><path d="M12 2.5l8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4z" /><path d="M12 12l8.5-4.6M12 12L3.5 7.4M12 12v9.5" /></>,
]
const serviceImgs = ['/img/svc-mobile.jpg', '/img/svc-web.jpg', '/img/svc-ai.jpg', '/img/svc-seo.jpg', '/img/svc-content.jpg', '/img/svc-web3.jpg']
function Services() {
  return (
    <section id="services" className="py-20 md:py-28">
      <div className={wrap}>
        <Reveal className="mx-auto max-w-3xl text-center">
          <Badge>Services</Badge>
          <h2 className="h-section mt-7 text-[clamp(2.3rem,5vw,4.4rem)]"><Words text="What we do." /></h2>
          <Para className="mx-auto mt-5 max-w-xl text-[17px] text-snow/70">Six services. One team. From the first prototype to the content that brings users in.</Para>
        </Reveal>
        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map(([t, d], i) => (
            <Reveal key={t} delay={(i % 3) * 0.07}>
              <article className="glass group h-full overflow-hidden rounded-3xl transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.06]">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={serviceImgs[i]} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                </div>
                <div className="p-7 md:p-8">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/[0.04]">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-snow" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{icons[i]}</svg>
                  </span>
                  <h3 className="mt-6 text-[22px] font-semibold leading-snug tracking-[-0.03em]">{t}</h3>
                  <p className="mt-3 leading-relaxed text-snow/65">{d}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- Process ---------------- */
function Process() {
  return (
    <section id="approach" className="py-20 md:py-28">
      <div className={wrap}>
        <Reveal className="mx-auto max-w-3xl text-center">
          <Badge>Process</Badge>
          <h2 className="h-section mt-7 text-[clamp(2.3rem,5vw,4.4rem)]"><Words text="Research first. Then build." /></h2>
          <Para className="mx-auto mt-5 max-w-xl text-[17px] text-snow/70">We don't ship one-size-fits-all. Every project starts with the people who will use the product.</Para>
        </Reveal>
        <ol className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <Reveal as="li" key={t} delay={i * 0.06} className="bg-ink p-8 md:p-10">
              <span className="text-sm font-semibold text-pink">0{i + 1}</span>
              <h3 className="mt-16 text-2xl font-semibold tracking-[-0.03em]">{t}</h3>
              <p className="mt-3 leading-relaxed text-snow/65">{d}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ---------------- Principles ---------------- */
function Principles() {
  return (
    <section id="principles" className="py-20 md:py-28">
      <div className={`${wrap} grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-20`}>
        <Reveal className="lg:sticky lg:top-32 lg:self-start">
          <Badge>Principles</Badge>
          <h2 className="h-section mt-7 text-[clamp(2.3rem,5vw,4.4rem)]"><Words text="What we stand on." /></h2>
          <Para className="mt-5 max-w-sm text-[17px] text-snow/70">A well-trained, motivated team, committed to every deliverable.</Para>
        </Reveal>
        <ul className="divide-y divide-white/10 border-y border-white/10">
          {principles.map(([t, d], i) => (
            <Reveal as="li" key={t} delay={i * 0.04} className="grid gap-2 py-7 md:grid-cols-[0.8fr_1.2fr] md:gap-8">
              <h3 className="text-xl font-semibold tracking-[-0.03em]">{t}</h3>
              <p className="leading-relaxed text-snow/65">{d}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------- Contact ---------------- */
function Contact() {
  const [sent, setSent] = useState(false)
  const input = 'w-full rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-4 text-snow placeholder:text-snow/35 outline-none transition-colors focus:border-white/40'
  return (
    <section id="contact" className="py-20 md:py-28">
      <div className={wrap}>
        <div className="glass relative overflow-hidden rounded-[2rem] p-8 md:rounded-[2.5rem] md:p-16">
          <img src="/img/cafe.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20" loading="lazy" />
          <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet/25 blur-[120px]" />
          <div className="relative grid gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <Badge>Contact</Badge>
              <h2 className="h-section mt-7 text-[clamp(2.4rem,5.4vw,4.8rem)]"><Words text="Got a niche?" /><br /><Words text="Let's build for it." delay={0.25} /></h2>
              <Para className="mt-6 max-w-md text-[17px] leading-relaxed text-snow/70">Tell us about your project and who it is for.</Para>
            </Reveal>
            <Reveal delay={0.08}>
              <form onSubmit={(e) => { e.preventDefault(); setSent(true) }} className="grid gap-4">
                <input required className={input} placeholder="Your name" aria-label="Your name" autoComplete="name" />
                <input required type="email" className={input} placeholder="Email address" aria-label="Email address" autoComplete="email" />
                <textarea rows={4} className={`${input} resize-none`} placeholder="Tell us about your project" aria-label="Project details" />
                <button className="pill-white mt-2 justify-self-start rounded-full px-8 py-4 text-[15px] font-semibold transition-transform hover:-translate-y-0.5">
                  {sent ? 'Thanks. We will be in touch.' : 'Send message'}
                </button>
              </form>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------- Footer ---------------- */
function Footer() {
  const site = 'https://digitallegendsagency.com'
  const links = [['About us', '/about-us/'], ['Blog', '/blog/'], ['FAQ', '/faq/'], ['Privacy policy', '/privacy-policy/'], ['Terms', '/terms-and-conditions/']]
  return (
    <footer className="border-t border-white/10">
      <div className={`${wrap} grid gap-10 py-14 md:grid-cols-[1.6fr_1fr_1fr]`}>
        <div>
          <img src="/img/logo.webp" alt="Digital Legends Agency" className="h-11 w-auto" />
          <p className="mt-5 max-w-xs text-snow/60">Mobile apps for niche markets. Built with AI.</p>
        </div>
        <ul className="space-y-3 text-snow/70">
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

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <div className="border-y border-white/10 py-6 md:py-8">
          <Marquee words={['Mobile apps', 'AI solutions', 'Web apps', 'SEO', 'Content', 'Web3']} className="h-display text-[clamp(2.4rem,6vw,5rem)] font-semibold text-snow" />
        </div>
        <Statement />
        <StudioImage />
        <Services />
        <Process />
        <Principles />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
