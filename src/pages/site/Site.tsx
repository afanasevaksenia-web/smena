import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useProjectContext } from '../../context/ProjectContext'
import { roleAtLeast } from '../../api/projects'
import { listContacts, type Contact } from '../../api/contacts'
import { listAssignments, ensureAssignment, setAssignmentTime, type Assignment } from '../../api/assignments'
import { computeWorkedTime, formatInProjectTimeZone, formatMinutes } from '../../lib/time'
import { downloadCsv } from '../../lib/csv'
import TimeEditModal from './TimeEditModal'

const TABS: { key: Contact['category']; label: string }[] = [
  { key: 'crew', label: 'Группа' },
  { key: 'actor', label: 'Актёры' },
  { key: 'transport', label: 'Транспорт' },
]

export default function Site() {
  const { project, viewingShift, myRole } = useProjectContext()
  const qc = useQueryClient()
  const canEdit = roleAtLeast(myRole, 'coordinator')
  const [tab, setTab] = useState<Contact['category']>('crew')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<{ assignment: Assignment; contact: Contact } | null>(null)

  const contactsQuery = useQuery({ queryKey: ['contacts', project.id], queryFn: () => listContacts(project.id) })
  const assignmentsQuery = useQuery({
    queryKey: ['assignments', viewingShift?.id],
    queryFn: () => listAssignments(viewingShift!.id),
    enabled: !!viewingShift,
  })

  const ensureMutation = useMutation({
    mutationFn: (contactId: string) => ensureAssignment(viewingShift!.id, contactId, null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments', viewingShift?.id] }),
  })

  const quickTimeMutation = useMutation({
    mutationFn: (input: { assignmentId: string; field: 'actual_arrival' | 'actual_work_stop' | 'actual_departure' }) =>
      setAssignmentTime(input.assignmentId, input.field, new Date().toISOString()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments', viewingShift?.id] }),
  })

  const contacts = (contactsQuery.data ?? []).filter((c) => c.category === tab)
  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return c.full_name.toLowerCase().includes(q) || (c.department ?? '').toLowerCase().includes(q)
  })

  const assignmentByContact = useMemo(() => {
    const map = new Map<string, Assignment>()
    for (const a of assignmentsQuery.data ?? []) map.set(a.contact_id, a)
    return map
  }, [assignmentsQuery.data])

  const tz = viewingShift?.timezone ?? 'Europe/Moscow'

  function exportTimesheet() {
    const rows: unknown[][] = [['Имя', 'Цех/роль', 'Телефон', 'Вызов', 'Прибытие', 'Стоп', 'Отъезд', 'Отработано', 'Переработка']]
    for (const c of contacts) {
      const a = assignmentByContact.get(c.id)
      const worked = a
        ? computeWorkedTime({
            callTime: a.call_time,
            actualArrival: a.actual_arrival,
            actualWorkStop: a.actual_work_stop,
            actualDeparture: a.actual_departure,
            plannedWrap: a.planned_wrap,
          })
        : null
      rows.push([
        c.full_name,
        c.department ?? '',
        c.phone ?? '',
        formatInProjectTimeZone(a?.call_time ?? null, tz),
        formatInProjectTimeZone(a?.actual_arrival ?? null, tz),
        formatInProjectTimeZone(a?.actual_work_stop ?? null, tz),
        formatInProjectTimeZone(a?.actual_departure ?? null, tz),
        worked ? formatMinutes(worked.workedMinutes) : '',
        worked ? formatMinutes(worked.overtimeMinutes) : '',
      ])
    }
    downloadCsv(`tabel-smena-${viewingShift?.shift_number ?? ''}`, rows)
  }

  if (!viewingShift) {
    return <div className="p-4 text-[var(--color-text-dim)]">Сначала создайте смену в разделе «Ещё → История смен».</div>
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="flex gap-2" role="tablist" aria-label="Разделы площадки">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`tap-target rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === t.key ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]' : 'bg-[var(--color-bg-raised)] text-[var(--color-text-dim)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени или цеху"
          aria-label="Поиск"
          className="tap-target flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="button"
          onClick={exportTimesheet}
          className="tap-target rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-dim)]"
        >
          Экспорт CSV
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {filtered.map((contact) => {
          const assignment = assignmentByContact.get(contact.id)
          const worked = assignment
            ? computeWorkedTime({
                callTime: assignment.call_time,
                actualArrival: assignment.actual_arrival,
                actualWorkStop: assignment.actual_work_stop,
                actualDeparture: assignment.actual_departure,
                plannedWrap: assignment.planned_wrap,
              })
            : null

          return (
            <li key={contact.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{contact.full_name}</div>
                  <div className="text-sm text-[var(--color-text-dim)]">{contact.department || '—'}</div>
                </div>
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="tap-target shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-accent)]">
                    Позвонить
                  </a>
                )}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--color-text-faint)] sm:grid-cols-4">
                <span>Вызов: {formatInProjectTimeZone(assignment?.call_time ?? null, tz)}</span>
                <span>Прибыл: {formatInProjectTimeZone(assignment?.actual_arrival ?? null, tz)}</span>
                <span>Стоп: {formatInProjectTimeZone(assignment?.actual_work_stop ?? null, tz)}</span>
                <span>Уехал: {formatInProjectTimeZone(assignment?.actual_departure ?? null, tz)}</span>
              </div>

              {worked && !worked.incomplete && (
                <div className="mt-1 text-xs">
                  {worked.error ? (
                    <span className="text-[var(--color-danger)]">{worked.error}</span>
                  ) : (
                    <span className="text-[var(--color-text-dim)]">
                      Отработано {formatMinutes(worked.workedMinutes)}
                      {worked.overtimeMinutes ? ` · переработка ${formatMinutes(worked.overtimeMinutes)}` : ''}
                      {worked.workEndSource === 'departure' && ' (по отъезду, стоп не отмечен)'}
                    </span>
                  )}
                </div>
              )}

              {canEdit && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {!assignment ? (
                    <button
                      type="button"
                      onClick={() => ensureMutation.mutate(contact.id)}
                      className="tap-target rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs"
                    >
                      Добавить на смену
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => quickTimeMutation.mutate({ assignmentId: assignment.id, field: 'actual_arrival' })}
                        className="tap-target rounded-lg bg-[var(--color-ok)]/15 px-3 py-1.5 text-xs text-[var(--color-ok)]"
                      >
                        Приехал
                      </button>
                      <button
                        type="button"
                        onClick={() => quickTimeMutation.mutate({ assignmentId: assignment.id, field: 'actual_work_stop' })}
                        className="tap-target rounded-lg bg-[var(--color-warn)]/15 px-3 py-1.5 text-xs text-[var(--color-warn)]"
                      >
                        Стоп
                      </button>
                      <button
                        type="button"
                        onClick={() => quickTimeMutation.mutate({ assignmentId: assignment.id, field: 'actual_departure' })}
                        className="tap-target rounded-lg bg-[var(--color-info)]/15 px-3 py-1.5 text-xs text-[var(--color-info)]"
                      >
                        Уехал
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing({ assignment, contact })}
                        className="tap-target rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-dim)]"
                      >
                        Исправить время
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
        {filtered.length === 0 && <p className="text-sm text-[var(--color-text-faint)]">Никого не найдено.</p>}
      </ul>

      {editing && (
        <TimeEditModal
          assignment={editing.assignment}
          contactName={editing.contact.full_name}
          timezone={tz}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
