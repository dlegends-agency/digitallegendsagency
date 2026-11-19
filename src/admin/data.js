import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export const COLORS = { sky: 'bg-sky', violet: 'bg-violet', pink: 'bg-pink', emerald: 'bg-emerald-400', amber: 'bg-amber-400', slate: 'bg-snow/50' }
export const COLOR_NAMES = Object.keys(COLORS)
const FALLBACK_CATEGORIES = [['Website', 'sky'], ['Client', 'violet'], ['Marketing', 'pink'], ['Internal', 'amber'], ['Product', 'emerald']]
  .map(([name, color]) => ({ id: name, name, color }))

/* Project categories. Falls back to a built-in list until the latest schema has been applied. */
export function useCategories() {
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES)
  const [ready, setReady] = useState(false)
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('categories').select('*').order('created_at')
    if (!error && data) { setCategories(data); setReady(true) }
  }, [])
  useEffect(() => { load() }, [load])
  const add = async (name, color) => {
    const { error } = await supabase.from('categories').insert({ name, color })
    if (!error) await load()
    return error
  }
  const remove = async (id) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) await load()
    return error
  }
  const colorOf = (name) => COLORS[categories.find((c) => c.name === name)?.color] || 'bg-sky'
  return { categories, ready, add, remove, colorOf }
}

/* The people a task can be assigned to (everyone on the admin list). */
let teamCache = null
export function useTeam() {
  const [team, setTeam] = useState(teamCache || [])
  useEffect(() => {
    let live = true
    supabase.rpc('list_team').then(({ data, error }) => {
      if (!live || error || !data) return
      teamCache = data
      setTeam(data)
    })
    return () => { live = false }
  }, [])
  const find = (task) => team.find((m) => m.user_id === task?.assignee_id) || (task?.assignee_email ? { email: task.assignee_email } : null)
  const byEmail = (email) => team.find((m) => m.email === email) || (email ? { email } : null)
  return { team, find, byEmail }
}
