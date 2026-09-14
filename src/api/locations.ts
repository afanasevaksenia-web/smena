import { supabase } from '../lib/supabase'
import type { Tables } from '../types/db'

export type Location = Tables<'locations'>

export async function listLocations(projectId: string): Promise<Location[]> {
  const { data, error } = await supabase.from('locations').select('*').eq('project_id', projectId).order('name')
  if (error) throw error
  return data
}

export async function createLocation(input: {
  projectId: string
  name: string
  groupName: string | null
  address: string | null
  directions: string | null
  parking: string | null
  notes: string | null
}): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .insert({
      project_id: input.projectId,
      name: input.name,
      group_name: input.groupName,
      address: input.address,
      directions: input.directions,
      parking: input.parking,
      notes: input.notes,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateLocation(id: string, patch: Partial<Location>) {
  const { error } = await supabase.from('locations').update(patch).eq('id', id)
  if (error) throw error
}
