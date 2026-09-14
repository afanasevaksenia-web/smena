import { supabase } from '../lib/supabase'
import type { Tables } from '../types/db'
import type { ParsedScene } from '../lib/scriptParser'

export type Scene = Tables<'scenes'>

export async function listScenes(projectId: string): Promise<Scene[]> {
  const { data, error } = await supabase
    .from('scenes')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('order_hint', { ascending: true })
  if (error) throw error
  return data
}

export async function createScenesFromImport(projectId: string, scenes: ParsedScene[]): Promise<void> {
  if (scenes.length === 0) return
  const rows = scenes.map((s, i) => ({
    project_id: projectId,
    episode: s.episode,
    scene_number: s.sceneNumber,
    stable_key: s.stableKey,
    int_ext: s.intExt,
    day_night: s.dayNight,
    location_text: s.locationText,
    synopsis: null,
    full_text: s.fullText,
    characters: s.characters,
    source: 'import' as const,
    order_hint: i,
  }))
  const { error } = await supabase.from('scenes').insert(rows)
  if (error) throw error
}

export async function updateScenesFromImport(updates: { existingId: string; parsed: ParsedScene }[]): Promise<void> {
  for (const { existingId, parsed } of updates) {
    const { error } = await supabase
      .from('scenes')
      .update({
        int_ext: parsed.intExt,
        day_night: parsed.dayNight,
        location_text: parsed.locationText,
        full_text: parsed.fullText,
        characters: parsed.characters,
        source: 'import',
      })
      .eq('id', existingId)
    if (error) throw error
  }
}

export async function updateScene(id: string, patch: Partial<Scene>) {
  const { error } = await supabase.from('scenes').update(patch).eq('id', id)
  if (error) throw error
}

export async function assignSceneToShift(id: string, shiftId: string | null, scheduledTime: string | null) {
  const { error } = await supabase.from('scenes').update({ shift_id: shiftId, scheduled_time: scheduledTime }).eq('id', id)
  if (error) throw error
}

export async function markSceneShot(id: string, shot: boolean) {
  const { error } = await supabase.from('scenes').update({ shot, shot_at: shot ? new Date().toISOString() : null }).eq('id', id)
  if (error) throw error
}

export async function deleteScene(id: string) {
  const { error } = await supabase.from('scenes').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
