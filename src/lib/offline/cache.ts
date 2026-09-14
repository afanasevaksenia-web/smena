import { getDb, type CacheTable } from './db'

export async function putCached<T extends { id: string }>(table: CacheTable, projectId: string, row: T): Promise<void> {
  const db = await getDb()
  await db.put('entities', {
    cacheKey: `${table}:${row.id}`,
    table,
    projectId,
    id: row.id,
    data: row,
    updatedAt: Date.now(),
  })
}

export async function putCachedMany<T extends { id: string }>(table: CacheTable, projectId: string, rows: T[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('entities', 'readwrite')
  await Promise.all(
    rows.map((row) =>
      tx.store.put({
        cacheKey: `${table}:${row.id}`,
        table,
        projectId,
        id: row.id,
        data: row,
        updatedAt: Date.now(),
      }),
    ),
  )
  await tx.done
}

export async function getCachedList<T>(table: CacheTable, projectId: string): Promise<T[]> {
  const db = await getDb()
  const rows = await db.getAllFromIndex('entities', 'by_table_project', [table, projectId])
  return rows.map((r) => r.data as T)
}

export async function getCachedOne<T>(table: CacheTable, id: string): Promise<T | null> {
  const db = await getDb()
  const row = await db.get('entities', `${table}:${id}`)
  return (row?.data as T) ?? null
}

export async function removeCached(table: CacheTable, id: string): Promise<void> {
  const db = await getDb()
  await db.delete('entities', `${table}:${id}`)
}

/**
 * Читает через кэш: пробует сеть, при успехе — кладёт в кэш и возвращает
 * свежие данные; при ошибке сети — тихо отдаёт то, что есть в кэше (может
 * быть пустым списком, если приложение открыли без сети в первый раз).
 */
export async function fetchThroughCache<T extends { id: string }>(
  table: CacheTable,
  projectId: string,
  fetcher: () => Promise<T[]>,
): Promise<{ data: T[]; fromCache: boolean }> {
  try {
    const fresh = await fetcher()
    await putCachedMany(table, projectId, fresh)
    return { data: fresh, fromCache: false }
  } catch (err) {
    const cached = await getCachedList<T>(table, projectId)
    if (cached.length === 0) throw err
    return { data: cached, fromCache: true }
  }
}
