import { supabase } from '../lib/supabase'
import type { Tables } from '../types/db'

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

export async function redeemInvite(code: string, displayName: string) {
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: code, p_display_name: displayName })
  if (error) throw error
  return data
}
