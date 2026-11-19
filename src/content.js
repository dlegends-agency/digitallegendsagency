export const nav = [
  ['Home', '#top'],
  ['Services', '#services'],
  ['How we work', '#approach'],
  ['Principles', '#principles'],
  ['Contact', '#contact'],
]

export const services = [
  ['Mobile App Development', 'Fast, simple apps for one specific audience. We build the whole thing, from first idea to launch.'],
  ['Web Application Development', 'Web products for the same niche audiences, built to handle growth.'],
  ['AI Solutions', 'AI where it earns its place: personalization, task automation and behavior prediction.'],
  ['SEO Strategy', 'So your app and your business show up when the right people search.'],
  ['Content Marketing', 'Articles, in-app content and social posts that make you the voice of your niche.'],
  ['Web3 Solutions', 'Products on emerging web3 technology, built so they can change as the technology does.'],
]

export const steps = [
  ['Learn the niche', 'We study the market, the people in it and what they are missing.'],
  ['Find the gap', 'Data and market insight show where a product can win.'],
  ['Design for them', 'The product is shaped around the people who will actually use it.'],
  ['Add AI', 'Personalization, task automation and behavior prediction go in where they help.'],
]

export const principles = [
  ['Quality', 'We craft carefully and test everything we ship.'],
  ['Experience', 'A hands-on team that has built products before.'],
  ['Innovation', 'New technology, used to build products that change how people live and work.'],
  ['Strategy', 'Market research comes before design. Always.'],
  ['Personalization', 'Every user gets an experience that fits them, at any scale.'],
  ['Scalability', 'Modular, flexible architecture that grows with your product.'],
]

export const socials = [
  ['Facebook', 'https://www.facebook.com/digitallegendsagency/'],
  ['LinkedIn', 'https://www.linkedin.com/in/team-voila-95307b379/'],
  ['Instagram', 'https://www.instagram.com/dlegends.agency/'],
]

export const hero = {
  line1: 'Apps for niche markets.',
  line2: 'Built with AI.',
  text: 'Digital Legends is a mobile app agency. We study a specialized audience, then design and build the product around it, from first idea to launch.',
}

// Only well-formed database content is accepted; anything else falls back to the defaults.
export const validators = {
  hero: (v) => !!v && typeof v === 'object' && ['line1', 'line2', 'text'].every((k) => typeof v[k] === 'string' && v[k].trim()),
  list: (v) => Array.isArray(v) && v.length > 0 && v.every((r) => Array.isArray(r) && r.length === 2 && r.every((x) => typeof x === 'string' && x.trim())),
}
