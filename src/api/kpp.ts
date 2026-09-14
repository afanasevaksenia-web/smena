import { supabase } from '../lib/supabase'
import type { Tables } from '../types/db'

export type KppDay = Tables<'kpp_days'>

export async function listKppDays(projectId: string): Promise<KppDay[]> {
  const { data, error } = await supabase.from('kpp_days').select('*').eq('project_id', projectId).order('date')
  if (error) throw error
  return data
}

export async function upsertKppDay(input: {
  projectId: string
  date: string
  type: KppDay['type']
  locationId: string | null
  shiftId: string | null
  notes: string | null
}): Promise<KppDay> {
  const { data, error } = await supabase
    .from('kpp_days')
    .upsert(
      {
        project_id: input.projectId,
        date: input.date,
        type: input.type,
        location_id: input.locationId,
        shift_id: input.shiftId,
        notes: input.notes,
      },
      { onConflict: 'project_id,date' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data
}
