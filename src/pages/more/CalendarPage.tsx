import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useProjectContext } from '../../context/ProjectContext'
import { roleAtLeast } from '../../api/projects'
import { listKppDays, upsertKppDay, type KppDay } from '../../api/kpp'
import { listShifts } from '../../api/shifts'
import { downloadCsv } from '../../lib/csv'

const TYPE_LABELS: Record<KppDay['type'], string> = {
  съёмка: 'Съёмка',
  снято: 'Снято',
  выходной: 'Выходной',
  отсыпной: 'Отсыпной',
}
const TYPE_COLORS: Record<KppDay['type'], string> = {
  съёмка: 'bg-[var(--color-accent)]/25 text-[var(--color-accent)]',
  снято: 'bg-[var(--color-ok)]/20 text-[var(--color-ok)]',
  выходной: 'bg-[var(--color-text-faint)]/20 text-[var(--color-text-dim)]',
  отсыпной: 'bg-[var(--color-info)]/20 text-[var(--color-info)]',
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function CalendarPage() {
  const { project, myRole } = useProjectContext()
  const canEdit = roleAtLeast(myRole, 'coordinator')
  const qc = useQueryClient()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const daysQuery = useQuery({ queryKey: ['kpp', project.id], queryFn: () => listKppDays(project.id) })
  const shiftsQuery = useQuery({ queryKey: ['shifts', project.id], queryFn: () => listShifts(project.id) })

  const byDate = useMemo(() => new Map((daysQuery.data ?? []).map((d) => [d.date, d])), [daysQuery.data])
  const shiftsByDate = useMemo(() => new Map((shiftsQuery.data ?? []).map((s) => [s.shift_date, s])), [shiftsQuery.data])

  const { todayIso, tomorrowIso } = useMemo(() => {
    const now = new Date()
    return { todayIso: toISODate(now), tomorrowIso: toISODate(new Date(now.getTime() + 86400000)) }
  }, [])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => toISODate(new Date(year, month, i + 1)))]

  const upsertMutation = useMutation({
    mutationFn: (input: { date: string; type: KppDay['type'] }) =>
      upsertKppDay({ projectId: project.id, date: input.date, type: input.type, locationId: null, shiftId: shiftsByDate.get(input.date)?.id ?? null, notes: byDate.get(input.date)?.notes ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpp', project.id] }),
  })

  function exportCsv() {
    const rows: unknown[][] = [['Дата', 'Тип', 'Примечания']]
    for (const d of [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))) {
      rows.push([d.date, TYPE_LABELS[d.type], d.notes ?? ''])
    }
    downloadCsv('kalendar-kpp', rows)
  }

  const selected = selectedDate ? byDate.get(selectedDate) : null
  const selectedShift = selectedDate ? shiftsByDate.get(selectedDate) : null

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Календарь КПП</h1>
        <div className="flex gap-2">
          <button onClick={() => setView(view === 'grid' ? 'list' : 'grid')} className="tap-target rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm">
            {view === 'grid' ? 'Список' : 'Сетка'}
          </button>
          <button onClick={exportCsv} className="tap-target rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm">
            Экспорт CSV
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="tap-target px-2 text-[var(--color-text-dim)]">
              ←
            </button>
            <div className="flex items-center gap-2">
              <span className="font-medium">{cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => setCursor(new Date())} className="text-xs text-[var(--color-accent)] underline-offset-2 hover:underline">
                Сегодня
              </button>
            </div>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="tap-target px-2 text-[var(--color-text-dim)]">
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--color-text-faint)]">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (!date) return <div key={i} />
              const day = byDate.get(date)
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`tap-target flex aspect-square flex-col items-center justify-center rounded-lg text-xs ${day ? TYPE_COLORS[day.type] : 'bg-[var(--color-bg-sunken)] text-[var(--color-text-faint)]'} ${
                    selectedDate === date ? 'ring-2 ring-[var(--color-accent)]' : ''
                  }`}
                >
                  <span className="font-medium">{Number(date.slice(-2))}</span>
                  {date === todayIso && <span className="text-[9px]">сегодня</span>}
                  {date === tomorrowIso && <span className="text-[9px]">завтра</span>}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {[...byDate.values()]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => setSelectedDate(d.date)}
                  className="tap-target flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 text-sm"
                >
                  <span>
                    {d.date} {d.date === todayIso && '· сегодня'} {d.date === tomorrowIso && '· завтра'}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${TYPE_COLORS[d.type]}`}>{TYPE_LABELS[d.type]}</span>
                </button>
              </li>
            ))}
        </ul>
      )}

      {selectedDate && (
        <div className="rounded-xl border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">{selectedDate}</h2>
            <button onClick={() => setSelectedDate(null)} aria-label="Закрыть">
              ✕
            </button>
          </div>
          {canEdit && (
            <div className="mb-3 flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABELS) as KppDay['type'][]).map((t) => (
                <button
                  key={t}
                  onClick={() => upsertMutation.mutate({ date: selectedDate, type: t })}
                  className={`tap-target rounded-full px-3 py-1 text-xs ${selected?.type === t ? TYPE_COLORS[t] : 'border border-[var(--color-border)] text-[var(--color-text-dim)]'}`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          )}
          {selected?.notes && <p className="mb-2 text-sm text-[var(--color-text-dim)]">{selected.notes}</p>}
          {selectedShift ? (
            <div className="flex gap-3 text-sm">
              <Link to="../callsheet" className="text-[var(--color-accent)]">
                Вызывной →
              </Link>
              <Link to="../site" className="text-[var(--color-accent)]">
                Табель →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-faint)]">На эту дату смена не создана.</p>
          )}
        </div>
      )}
    </div>
  )
}
