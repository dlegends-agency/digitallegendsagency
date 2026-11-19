import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { hero, services, steps, principles, validators } from '../content'

export const defaults = { hero, services, steps, principles }

// Only well-formed database content replaces the defaults, so a bad edit can never break the site.
export function mergeContent(rows) {
  const next = { ...defaults }
  for (const { key, value } of rows || []) {
    if (key === 'hero' && validators.hero(value)) next.hero = value
    else if (['services', 'steps', 'principles'].includes(key) && validators.list(value)) next[key] = value
  }
  return next
}

export function useSiteContent() {
  const [content, setContent] = useState(defaults)
  useEffect(() => {
    let live = true
    supabase.from('site_content').select('key,value').then(({ data, error }) => {
      if (live && !error) setContent(mergeContent(data))
    })
    return () => { live = false }
  }, [])
  return content
}
