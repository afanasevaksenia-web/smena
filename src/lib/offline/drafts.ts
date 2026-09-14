import { getDb } from './db'

function draftKey(projectId: string, channelId: string): string {
  return `draft:${projectId}:${channelId}`
}

export async function getDraft(projectId: string, channelId: string): Promise<string> {
  const db = await getDb()
  const row = await db.get('meta', draftKey(projectId, channelId))
  return (row?.value as string) ?? ''
}

export async function setDraft(projectId: string, channelId: string, text: string): Promise<void> {
  const db = await getDb()
  const key = draftKey(projectId, channelId)
  if (!text) {
    await db.delete('meta', key)
    return
  }
  await db.put('meta', { key, value: text })
}
