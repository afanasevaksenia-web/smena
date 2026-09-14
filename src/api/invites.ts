import { supabase } from '../lib/supabase'
import type { Tables } from '../types/db'
import type { Project } from './projects'

export type Invite = Tables<'invites'>

export async function listInvites(projectId: string): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createInvite(input: {
  projectId: string
  role: Invite['role']
  ttlHours: number
  maxUses: number
}): Promise<Invite> {
  const { data, error } = await supabase.rpc('create_invite', {
    p_project: input.projectId,
    p_role: input.role,
    p_ttl_hours: input.ttlHours,
    p_max_uses: input.maxUses,
  })
  if (error) throw error
  return data
}

export async function revokeInvite(id: string) {
  const { error } = await supabase.rpc('revoke_invite', { p_invite: id })
  if (error) throw error
}

/**
 * redeem_invite намеренно не бросает Postgres-исключение на ожидаемых
 * отказах (неверный код / истёк / rate-limit) — иначе Postgres откатывает
 * весь вызов целиком, включая запись неудачной попытки, и rate-limit
 * никогда не сработает. Вместо этого функция возвращает {ok, error,
 * project}, и уже здесь, на клиенте, отказ превращается в обычную JS-ошибку.
 */
export async function redeemInvite(code: string, displayName: string): Promise<Project> {
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: code, p_display_name: displayName })
  if (error) throw error
  const result = data as unknown as { ok: boolean; error: string | null; project: Project | null }
  if (!result.ok || !result.project) {
    throw new Error(result.error ?? 'Не удалось присоединиться к проекту')
  }
  return result.project
}
