import { supabase } from '../lib/supabase'
import type { Tables } from '../types/db'

export type Project = Tables<'projects'>
export type ProjectMember = Tables<'project_members'>

export async function listMyProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createProject(input: {
  name: string
  firstShiftDate: string | null
  locationName: string | null
  displayName: string
}): Promise<Project> {
  const { data, error } = await supabase.rpc('create_project', {
    p_name: input.name,
    // codegen не помечает date/text параметры как nullable, хотя функция
    // явно принимает NULL для необязательных полей
    p_first_shift_date: input.firstShiftDate as unknown as string,
    p_location_name: input.locationName as unknown as string,
    p_display_name: input.displayName,
  })
  if (error) throw error
  return data
}

export async function updateProject(id: string, patch: Partial<Pick<Project, 'name' | 'location_name' | 'status' | 'settings'>>) {
  const { error } = await supabase.from('projects').update(patch).eq('id', id)
  if (error) throw error
}

export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })
  if (error) throw error
  return data
}

export async function setMemberRole(projectId: string, userId: string, role: ProjectMember['role']) {
  const { error } = await supabase.rpc('set_member_role', { p_project: projectId, p_user: userId, p_role: role })
  if (error) throw error
}

export async function removeMember(projectId: string, userId: string) {
  const { error } = await supabase.rpc('remove_member', { p_project: projectId, p_user: userId })
  if (error) throw error
}

export function myRole(members: ProjectMember[], userId: string | undefined): ProjectMember['role'] | null {
  if (!userId) return null
  return members.find((m) => m.user_id === userId)?.role ?? null
}

export function roleAtLeast(role: ProjectMember['role'] | null, min: ProjectMember['role']): boolean {
  const rank: Record<ProjectMember['role'], number> = { owner: 3, coordinator: 2, member: 1 }
  if (!role) return false
  return rank[role] >= rank[min]
}
