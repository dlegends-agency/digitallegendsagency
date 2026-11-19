// Reads a public GitHub repository (no login needed) and drafts the resource fields from it.
const API = 'https://api.github.com/repos'

export const parseRepo = (url) => {
  const m = String(url || '').trim().match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i)
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/i, '') } : null
}

const decode = (b64) => {
  try { return new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, '')), (c) => c.charCodeAt(0))) } catch { return '' }
}

export async function fetchRepo(url) {
  const p = parseRepo(url)
  if (!p) throw new Error('Paste a GitHub repository link, like https://github.com/owner/repo')
  const res = await fetch(`${API}/${p.owner}/${p.repo}`, { headers: { Accept: 'application/vnd.github+json' } })
  if (res.status === 404) throw new Error('That repository was not found. Check the link, and that the repository is public.')
  if (res.status === 403 || res.status === 429) throw new Error('GitHub is limiting requests from this network. Wait a few minutes, then try again.')
  if (!res.ok) throw new Error(`GitHub answered with an error (${res.status}). Try again in a moment.`)
  const d = await res.json()

  let readme = ''
  try {
    const rr = await fetch(`${API}/${p.owner}/${p.repo}/readme`, { headers: { Accept: 'application/vnd.github+json' } })
    if (rr.ok) readme = decode((await rr.json()).content)
  } catch { /* the README is optional */ }

  const lic = d.license && d.license.spdx_id && d.license.spdx_id !== 'NOASSERTION' ? d.license.spdx_id : d.license?.name || null
  return {
    fullName: d.full_name, name: d.name, description: (d.description || '').trim(), homepage: (d.homepage || '').trim(),
    stars: d.stargazers_count ?? 0, language: d.language || null, license: lic, pushedAt: d.pushed_at || null,
    topics: Array.isArray(d.topics) ? d.topics : [], htmlUrl: d.html_url, readme,
  }
}

const clip = (s, n) => {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  const cut = t.slice(0, n - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > n * 0.6 ? cut.lastIndexOf(' ') : cut.length).replace(/[,.;:\s-]+$/, '')}…`
}

/* First readable paragraph of a README: skips headings, badges, images, tables, HTML and code. */
export function readmeOverview(readme) {
  let inCode = false
  const blocks = []
  let cur = []
  for (const raw of String(readme || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (line.startsWith('```')) { inCode = !inCode; continue }
    if (inCode) continue
    if (!line) { if (cur.length) { blocks.push(cur.join(' ')); cur = [] } continue }
    if (/^(#|>|\||!\[|\[!\[|<|[-*+]\s|\d+\.\s|---|===)/.test(line)) { if (cur.length) { blocks.push(cur.join(' ')); cur = [] } continue }
    cur.push(line)
  }
  if (cur.length) blocks.push(cur.join(' '))
  const clean = (t) => t.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return blocks.map(clean).find((t) => t.length >= 60) || ''
}

const humanize = (name) => { const t = name.replace(/[-_]+/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1) }

/* Turns repository details into a first draft the editor can refine. */
export function draftFrom(info) {
  const overview = info.description || readmeOverview(info.readme)
  const tags = [...new Set([...(info.topics || []), ...(info.language ? [info.language] : [])].map((t) => t.toLowerCase()))].slice(0, 10)
  const facts = [`**${info.fullName}** has ${info.stars.toLocaleString('en-US')} stars on GitHub`]
  if (info.language) facts.push(`is written mostly in ${info.language}`)
  if (info.license) facts.push(`and is released under the ${info.license} licence`)
  const links = [`- [${info.fullName} on GitHub](${info.htmlUrl})`]
  if (info.homepage) links.unshift(`- [Website](${/^https?:/i.test(info.homepage) ? info.homepage : `https://${info.homepage}`})`)
  const body = [
    overview,
    `## What is this repo\n\n${facts.length > 2 ? `${facts[0]}, ${facts[1]} ${facts[2]}.` : `${facts.join(' ')}.`}`,
    '## Where it fits in a real build\n\n_Add your own notes here: what you tried it on, what worked, and who it is for._',
    `## Links\n\n${links.join('\n')}`,
  ].filter(Boolean).join('\n\n')
  return {
    title: humanize(info.name),
    slug: info.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100),
    summary: clip(overview, 160),
    tags, body,
  }
}

export const fmtStars = (n) => (n == null ? '–' : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n))
export const timeAgo = (iso) => {
  if (!iso) return '–'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
  if (days < 1) return 'today'
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}
