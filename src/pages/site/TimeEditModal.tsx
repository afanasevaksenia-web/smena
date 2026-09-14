import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { listTimeEditLog, setAssignmentTime, type Assignment } from '../../api/assignments'
import { formatInProjectTimeZone } from '../../lib/time'

const FIELDS: { key: 'actual_arrival' | 'actual_work_stop' | 'actual_departure' | 'call_time' | 'planned_wrap'; label: string }[] = [
  { key: 'call_time', label: 'Вызов' },
  { key: 'actual_arrival', label: 'Прибытие' },
  { key: 'actual_work_stop', label: 'Стоп работы' },
  { key: 'actual_departure', label: 'Отъезд' },
  { key: 'planned_wrap', label: 'Плановый стоп' },
]

function toLocalInputValue(iso: string | null, tz: string): string {
  if (!iso) return ''
  return formatInTimeZone(new Date(iso), tz, "yyyy-MM-dd'T'HH:mm")
}

export default function TimeEditModal({
  assignment,
  contactName,
  timezone,
  onClose,
}: {
  assignment: Assignment
  contactName: string
  timezone: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, toLocalInputValue(assignment[f.key], timezone)])),
  )
  const [reason, setReason] = useState('')

  const logQuery = useQuery({ queryKey: ['time-edit-log', assignment.id], queryFn: () => listTimeEditLog(assignment.id) })

  const mutation = useMutation({
    mutationFn: async () => {
      for (const f of FIELDS) {
        const local = values[f.key]
        const currentIso = assignment[f.key]
        const nextIso = local ? fromZonedTime(local, timezone).toISOString() : null
        if (nextIso === currentIso) continue
        await setAssignmentTime(assignment.id, f.key, nextIso, reason || undefined)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] })
      qc.invalidateQueries({ queryKey: ['time-edit-log', assignment.id] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 md:items-center" role="dialog" aria-modal="true" aria-label="Исправление времени">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--color-bg-raised)] p-4 md:rounded-2xl">
        <h2 className="mb-3 font-medium">Время — {contactName}</h2>

        <div className="flex flex-col gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--color-text-dim)]">{f.label}</span>
              <input
                type="datetime-local"
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-text-dim)]">Причина исправления (необязательно)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
            />
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="tap-target flex-1 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-dim)]"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="tap-target flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-text)] disabled:opacity-60"
          >
            Сохранить
          </button>
        </div>

        {(logQuery.data ?? []).length > 0 && (
          <div className="mt-5">
            <div className="mb-1 text-xs font-medium text-[var(--color-text-dim)]">История исправлений</div>
            <ul className="flex flex-col gap-1 text-xs text-[var(--color-text-faint)]">
              {(logQuery.data ?? []).map((entry) => (
                <li key={entry.id}>
                  {formatInProjectTimeZone(entry.edited_at, timezone, 'd MMM HH:mm')} · {entry.field}:{' '}
                  {formatInProjectTimeZone(entry.old_value, timezone)} → {formatInProjectTimeZone(entry.new_value, timezone)}
                  {entry.reason ? ` (${entry.reason})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
