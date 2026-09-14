function key(channelId: string): string {
  return `smena:lastRead:${channelId}`
}

export function getLastRead(channelId: string): string | null {
  try {
    return localStorage.getItem(key(channelId))
  } catch {
    return null
  }
}

export function markRead(channelId: string, iso: string): void {
  try {
    localStorage.setItem(key(channelId), iso)
  } catch {
    // ignore — недоступен localStorage
  }
}

export function countUnread(channelId: string, messages: { created_at: string; author_id: string }[], myUserId: string | undefined): number {
  const lastRead = getLastRead(channelId)
  if (!lastRead) return messages.filter((m) => m.author_id !== myUserId).length
  return messages.filter((m) => m.created_at > lastRead && m.author_id !== myUserId).length
}
