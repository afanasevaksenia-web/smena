import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { processOutbox } from '../lib/offline/outbox'
import { outboxHandlers } from '../lib/offline/syncHandlers'

/**
 * Молча пытается отправить очередь при запуске и при восстановлении связи.
 * Не показывает "синхронизацию" как факт, если она не подключена — здесь
 * она подключена по-настоящему (реальные вызовы Supabase, идемпотентные по
 * client_op_id), поэтому индикатор оправдан.
 */
export default function OutboxSync() {
  const qc = useQueryClient()

  useEffect(() => {
    const flush = () => {
      processOutbox(outboxHandlers).then((result) => {
        if (result.ok > 0) {
          qc.invalidateQueries({ queryKey: ['messages'] })
          qc.invalidateQueries({ queryKey: ['board'] })
          qc.invalidateQueries({ queryKey: ['member-shift-status'] })
        }
      })
    }
    flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [qc])

  return null
}
