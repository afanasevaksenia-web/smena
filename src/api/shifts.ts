import { supabase } from '../lib/supabase'
import type { Tables, Enums } from '../types/db'

export type Shift = Tables<'shifts'>
export type ShiftStatus = Enums<'shift_status'>
export type MemberStatus = Enums<'member_status'>

export async function listShifts(projectId: string): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('project_id', projectId)
    .order('shift_date', { ascending: true })
  if (error) throw error
  return data
}

export async function getShift(id: string): Promise<Shift> {
  const { data, error } = await supabase.from('shifts').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createShift(input: {
  projectId: string
  shiftNumber: number
  shiftDate: string
  timezone: string
  locationId: string | null
  callTime: string | null
  lunchTime: string | null
  plannedWrap: string | null
}): Promise<Shift> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Не авторизован')
  const { data, error } = await supabase
    .from('shifts')
    .insert({
      project_id: input.projectId,
      shift_number: input.shiftNumber,
      shift_date: input.shiftDate,
      timezone: input.timezone,
      location_id: input.locationId,
      call_time: input.callTime,
      lunch_time: input.lunchTime,
      planned_wrap: input.plannedWrap,
      created_by: auth.user.id,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateShift(id: string, patch: Partial<Shift>) {
  const { error } = await supabase.from('shifts').update(patch).eq('id', id)
  if (error) throw error
}

export async function setShiftStatus(shiftId: string, status: ShiftStatus): Promise<Shift> {
  const { data, error } = await supabase.rpc('set_shift_status', { p_shift: shiftId, p_status: status })
  if (error) throw error
  return data
}

export async function setMyShiftStatus(shiftId: string, status: MemberStatus): Promise<void> {
  const { error } = await supabase.rpc('set_my_shift_status', { p_shift: shiftId, p_status: status })
  if (error) throw error
}

export async function listMemberShiftStatuses(shiftId: string) {
  const { data, error } = await supabase.from('member_shift_status').select('*').eq('shift_id', shiftId)
  if (error) throw error
  return data
}

export async function listShiftStatusLog(shiftId: string) {
  const { data, error } = await supabase
    .from('shift_status_log')
    .select('*')
    .eq('shift_id', shiftId)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return data
}
