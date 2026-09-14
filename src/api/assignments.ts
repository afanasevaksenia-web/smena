import { supabase } from '../lib/supabase'
import type { Tables } from '../types/db'

export type Assignment = Tables<'assignments'>
export type TimeEditLog = Tables<'time_edit_log'>

export async function listAssignments(shiftId: string): Promise<Assignment[]> {
  const { data, error } = await supabase.from('assignments').select('*').eq('shift_id', shiftId)
  if (error) throw error
  return data
}

export async function ensureAssignment(shiftId: string, contactId: string, callTime: string | null): Promise<Assignment> {
  const { data, error } = await supabase
    .from('assignments')
    .upsert({ shift_id: shiftId, contact_id: contactId, call_time: callTime }, { onConflict: 'shift_id,contact_id', ignoreDuplicates: true })
    .select('*')
    .single()
  if (error) throw error
  return data
}

type EditableTimeField = 'actual_arrival' | 'actual_work_stop' | 'actual_departure' | 'call_time' | 'planned_wrap'

export async function setAssignmentTime(
  assignmentId: string,
  field: EditableTimeField,
  value: string | null,
  reason?: string,
): Promise<Assignment> {
  const { data, error } = await supabase.rpc('set_assignment_time', {
    p_assignment: assignmentId,
    p_field: field,
    // codegen не помечает параметры timestamptz/text как nullable, хотя
    // функция принимает NULL (чтобы можно было очистить отметку времени)
    p_value: value as unknown as string,
    p_reason: reason,
  })
  if (error) throw error
  return data
}

export async function listTimeEditLog(assignmentId: string): Promise<TimeEditLog[]> {
  const { data, error } = await supabase
    .from('time_edit_log')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('edited_at', { ascending: false })
  if (error) throw error
  return data
}

export async function listAssignmentsForShifts(shiftIds: string[]): Promise<Assignment[]> {
  if (shiftIds.length === 0) return []
  const { data, error } = await supabase.from('assignments').select('*').in('shift_id', shiftIds)
  if (error) throw error
  return data
}
