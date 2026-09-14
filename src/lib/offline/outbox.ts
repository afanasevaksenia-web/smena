import { getDb, type OutboxKind, type OutboxOp } from './db'

export async function enqueue(kind: OutboxKind, payload: Record<string, unknown>, opId: string): Promise<OutboxOp> {
  const db = await getDb()
  const op: OutboxOp = {
    id: opId,
    kind,
    payload,
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
    lastError: null,
  }
  await db.put('outbox', op)
  return op
}

export async function listOutbox(): Promise<OutboxOp[]> {
  const db = await getDb()
  const all = await db.getAll('outbox')
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function removeFromOutbox(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('outbox', id)
}

async function markError(id: string, error: string): Promise<void> {
  const db = await getDb()
  const op = await db.get('outbox', id)
  if (!op) return
  op.status = 'error'
  op.attempts += 1
  op.lastError = error
  await db.put('outbox', op)
}

export type OutboxHandlers = Record<OutboxKind, (payload: Record<string, unknown>, opId: string) => Promise<void>>

let processing = false

/**
 * Отправляет очередь по порядку создания. Каждая операция идемпотентна на
 * сервере (client_op_id уникален), поэтому повторная отправка после сбоя
 * безопасна и не создаёт дубликатов. Одна неудачная операция не блокирует
 * остальные — соседние по времени независимы (разные сообщения/события).
 */
export async function processOutbox(handlers: OutboxHandlers): Promise<{ ok: number; failed: number }> {
  if (processing) return { ok: 0, failed: 0 }
  processing = true
  let ok = 0
  let failed = 0
  try {
    const ops = await listOutbox()
    for (const op of ops) {
      try {
        await handlers[op.kind](op.payload, op.id)
        await removeFromOutbox(op.id)
        ok += 1
      } catch (err) {
        await markError(op.id, err instanceof Error ? err.message : String(err))
        failed += 1
      }
    }
  } finally {
    processing = false
  }
  return { ok, failed }
}
