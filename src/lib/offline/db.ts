import { openDB, type IDBPDatabase } from 'idb'

// Единая локальная база: кэш прочитанных данных (для работы без сети) +
// исходящая очередь ("outbox") для действий, сделанных офлайн.
// Раздел 14 ТЗ: у каждой операции уникальный ID, повторная отправка безопасна.

export type CacheTable =
  | 'projects'
  | 'project_members'
  | 'contacts'
  | 'locations'
  | 'shifts'
  | 'scenes'
  | 'assignments'
  | 'channels'
  | 'messages'
  | 'board_events'
  | 'kpp_days'
  | 'member_shift_status'

export interface CacheRow {
  cacheKey: string // `${table}:${id}`
  table: CacheTable
  projectId: string
  id: string
  data: unknown
  updatedAt: number
}

export type OutboxKind =
  | 'send_message'
  | 'post_board_event'
  | 'set_my_status'

export interface OutboxOp {
  id: string // client_op_id — используется и как PK очереди, и для идемпотентности на сервере
  kind: OutboxKind
  payload: Record<string, unknown>
  createdAt: number
  attempts: number
  status: 'pending' | 'error'
  lastError: string | null
}

interface SmenaDbSchema {
  entities: CacheRow
  outbox: OutboxOp
  meta: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<SmenaDbSchema>> | null = null

export function getDb(): Promise<IDBPDatabase<SmenaDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<SmenaDbSchema>('smena', 1, {
      upgrade(db) {
        const entities = db.createObjectStore('entities', { keyPath: 'cacheKey' })
        entities.createIndex('by_table_project', ['table', 'projectId'])
        entities.createIndex('by_table', 'table')

        db.createObjectStore('outbox', { keyPath: 'id' })
        db.createObjectStore('meta', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}

/** Полная очистка локальной базы — вызывается при выходе из аккаунта, чтобы не показать кэш другого пользователя. */
export async function clearLocalDb(): Promise<void> {
  const db = await getDb()
  await Promise.all([
    db.clear('entities'),
    db.clear('outbox'),
    db.clear('meta'),
  ])
}
