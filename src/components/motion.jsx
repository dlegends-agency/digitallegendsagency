import { useRef } from 'react'
import { motion, useScroll, useTransform, useMotionValue, useSpring, useVelocity, useAnimationFrame } from 'framer-motion'

export const ease = [0.16, 1, 0.3, 1]

/* Block fade-up (cards, images, lists) */
export function Reveal({ children, className = '', delay = 0, as = 'div' }) {
  const Tag = motion[as]
  return (
    <Tag className={className} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.9, ease, delay }}>
      {children}
    </Tag>
  )
}

/* Headline: each word rises out of a mask. Observes the wrapper, not the clipped word. */
export function Words({ text, className = '', delay = 0, stagger = 0.06, when }) {
  const trigger = when === undefined
    ? { whileInView: 'show', viewport: { once: true, amount: 0.4 } }
    : { animate: when ? 'show' : 'hidden' }
  return (
    <motion.span className={className} aria-label={text} initial="hidden" {...trigger}>
      {text.split(' ').map((w, i) => (
        <span key={i} aria-hidden="true" className="mr-[0.25em] inline-block overflow-hidden pb-[0.16em] -mb-[0.16em] align-bottom">
          <motion.span className="inline-block"
            variants={{
              hidden: { y: '115%', rotate: 4, opacity: 0 },
              show: { y: 0, rotate: 0, opacity: 1, transition: { duration: 1.1, ease, delay: delay + i * stagger } },
            }}>
            {w}
          </motion.span>
        </span>
      ))}
    </motion.span>
  )
}

/* Paragraph: soft blur-in, line by line feel via a single staggered block */
export function Para({ children, className = '', delay = 0 }) {
  return (
    <motion.p className={className} initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 1, ease, delay }}>
      {children}
    </motion.p>
  )
}

/* Scroll-linked text: words brighten as you scroll through the block */
function Tok({ children, range, progress, className }) {
  const o = useTransform(progress, range, [0.18, 1])
  return <motion.span style={{ opacity: o }} className={`mr-[0.22em] inline-block ${className || ''}`}>{children}</motion.span>
}
export function ScrollText({ segments, className = '' }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.55'] })
  const words = segments.flatMap(([t, strong]) => t.split(' ').filter(Boolean).map((w) => [w, strong]))
  return (
    <p ref={ref} className={className}>
      {words.map(([w, strong], i) => (
        <Tok key={i} progress={scrollYProgress} range={[i / words.length, Math.min(1, (i + 4) / words.length)]} className={strong ? 'text-snow' : 'text-snow/60'}>
          {w}
        </Tok>
      ))}
    </p>
  )
}

/* Parallax wrapper for images */
export function Parallax({ children, className = '', amount = 40 }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [-amount, amount])
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div style={{ y, scale: 1.15 }} className="h-full w-full">{children}</motion.div>
    </div>
  )
}

/* Marquee: drifts on its own, speeds up and reverses with scroll velocity */
const wrapRange = (min, max, v) => { const r = max - min; return ((((v - min) % r) + r) % r) + min }
export function Marquee({ words, className = '' }) {
  const base = useMotionValue(0)
  const { scrollY } = useScroll()
  const vel = useVelocity(scrollY)
  const smooth = useSpring(vel, { damping: 50, stiffness: 400 })
  const factor = useTransform(smooth, [0, 1000], [0, 4], { clamp: false })
  const dir = useRef(1)
  const x = useTransform(base, (v) => `${wrapRange(-25, 0, v)}%`)
  useAnimationFrame((_, delta) => {
    if (factor.get() < 0) dir.current = -1
    else if (factor.get() > 0) dir.current = 1
    let move = dir.current * -1.2 * (delta / 1000)
    move += dir.current * move * Math.abs(factor.get())
    base.set(base.get() + move)
  })
  const row = words.flatMap((w, i) => [
    <span key={`w${i}`} className={i % 2 ? 'text-transparent [-webkit-text-stroke:1.5px_rgba(245,245,247,.55)]' : ''}>{w}</span>,
    <span key={`d${i}`} className="text-pink">/</span>,
  ])
  return (
    <div className={`overflow-hidden whitespace-nowrap ${className}`} aria-hidden="true">
      <motion.div style={{ x }} className="flex w-max gap-[0.5em]">
        {[0, 1, 2, 3].map((n) => <div key={n} className="flex gap-[0.5em]">{row}</div>)}
      </motion.div>
    </div>
  )
}
