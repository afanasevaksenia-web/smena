import { supabase } from '../lib/supabase'
import type { Tables } from '../types/db'

export type Channel = Tables<'channels'>
export type Message = Tables<'messages'>

export async function listChannels(projectId: string): Promise<Channel[]> {
  const { data, error } = await supabase.from('channels').select('*').eq('project_id', projectId)
  if (error) throw error
  return data
}

export async function ensureDepartmentChannel(projectId: string, department: string): Promise<Channel> {
  const { data: existing } = await supabase
    .from('channels')
    .select('*')
    .eq('project_id', projectId)
    .eq('type', 'department')
    .eq('department', department)
    .maybeSingle()
  if (existing) return existing

  const { data, error } = await supabase
    .from('channels')
    .insert({ project_id: projectId, type: 'department', department, name: department })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function ensureSceneChannel(projectId: string, sceneId: string, name: string): Promise<Channel> {
  const { data: existing } = await supabase.from('channels').select('*').eq('project_id', projectId).eq('scene_id', sceneId).maybeSingle()
  if (existing) return existing

  const { data, error } = await supabase
    .from('channels')
    .insert({ project_id: projectId, type: 'scene', scene_id: sceneId, name })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function listMessages(channelId: string, limit = 200): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data
}

export async function sendMessage(input: {
  channelId: string
  authorId: string
  text: string
  replyToId: string | null
  clientOpId: string
}): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      channel_id: input.channelId,
      author_id: input.authorId,
      text: input.text,
      reply_to_id: input.replyToId,
      client_op_id: input.clientOpId,
    })
    .select('*')
    .single()

  if (error) {
    // повторная отправка после того, как предыдущая попытка на самом деле
    // дошла до сервера, но ответ был потерян (обрыв связи) — не дублируем
    if (error.code === '23505') {
      const { data: existing, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', input.channelId)
        .eq('client_op_id', input.clientOpId)
        .single()
      if (fetchError) throw fetchError
      return existing
    }
    throw error
  }
  return data
}
