import { supabase } from '../lib/supabase'
import type { Tables } from '../types/db'

export type Contact = Tables<'contacts'>

export async function listContacts(projectId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('project_id', projectId)
    .eq('archived', false)
    .order('full_name', { ascending: true })
  if (error) throw error
  return data
}

export async function createContact(input: {
  projectId: string
  category: Contact['category']
  fullName: string
  department: string | null
  phone: string | null
}): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      project_id: input.projectId,
      category: input.category,
      full_name: input.fullName,
      department: input.department,
      phone: input.phone,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateContact(id: string, patch: Partial<Pick<Contact, 'full_name' | 'department' | 'phone' | 'archived' | 'category'>>) {
  const { error } = await supabase.from('contacts').update(patch).eq('id', id)
  if (error) throw error
}
