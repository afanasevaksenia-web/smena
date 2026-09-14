import { supabase } from '../lib/supabase'
import type { Tables, Json } from '../types/db'

export type BoardEvent = Tables<'board_events'>

export async function listBoardEvents(shiftId: string): Promise<BoardEvent[]> {
  const { data, error } = await supabase
    .from('board_events')
    .select('*')
    .eq('shift_id', shiftId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function postBoardEvent(input: {
  projectId: string
  shiftId: string
  type: BoardEvent['type']
  text: string
  payload?: Record<string, unknown>
  authorId: string
  clientOpId: string
}): Promise<BoardEvent> {
  const { data, error } = await supabase
    .from('board_events')
    .insert({
      project_id: input.projectId,
      shift_id: input.shiftId,
      type: input.type,
      text: input.text,
      payload: (input.payload ?? {}) as Json,
      author_id: input.authorId,
      client_op_id: input.clientOpId,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: fetchError } = await supabase
        .from('board_events')
        .select('*')
        .eq('shift_id', input.shiftId)
        .eq('client_op_id', input.clientOpId)
        .single()
      if (fetchError) throw fetchError
      return existing
    }
    throw error
  }
  return data
}
