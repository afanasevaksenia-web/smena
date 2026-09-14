import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useProjectContext } from '../../context/ProjectContext'
import { useProjectState } from '../../state/project'
import { roleAtLeast } from '../../api/projects'
import { listShifts, createShift } from '../../api/shifts'
import { listLocations } from '../../api/locations'
import { fromZonedTime } from 'date-fns-tz'

export default function ShiftHistoryPage() {
  const { project, myRole } = useProjectContext()
  const canCreate = roleAtLeast(myRole, 'coordinator')
  const qc = useQueryClient()
  const navigate = useNavigate()
  const setViewingShift = useProjectState((s) => s.setViewingShift)
  const [creating, setCreating] = useState(false)

  const shiftsQuery = useQuery({ queryKey: ['shifts', project.id], queryFn: () => listShifts(project.id) })
  const locationsQuery = useQuery({ queryKey: ['locations', project.id], queryFn: () => listLocations(project.id) })

  const nextNumber = (shiftsQuery.data?.length ?? 0) + 1
  const [form, setForm] = useState({
    shiftDate: new Date().toISOString().slice(0, 10),
    locationId: '',
    call: '08:00',
    lunch: '13:00',
    wrap: '20:00',
    timezone: 'Europe/Moscow',
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createShift({
        projectId: project.id,
        shiftNumber: nextNumber,
        shiftDate: form.shiftDate,
        timezone: form.timezone,
        locationId: form.locationId || null,
        callTime: fromZonedTime(`${form.shiftDate}T${form.call}`, form.timezone).toISOString(),
        lunchTime: fromZonedTime(`${form.shiftDate}T${form.lunch}`, form.timezone).toISOString(),
        plannedWrap: fromZonedTime(`${form.shiftDate}T${form.wrap}`, form.timezone).toISOString(),
      }),
    onSuccess: (shift) => {
      qc.invalidateQueries({ queryKey: ['shifts', project.id] })
      setCreating(false)
      setViewingShift(shift.id)
      navigate('../today')
    },
  })

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">История смен</h1>
        {canCreate && (
          <button onClick={() => setCreating((v) => !v)} className="tap-target rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-text)]">
            + Смена
          </button>
        )}
      </div>

      {creating && (
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-3 text-sm">
          <div className="text-[var(--color-text-dim)]">Смена №{nextNumber}</div>
          <input type="date" value={form.shiftDate} onChange={(e) => setForm((f) => ({ ...f, shiftDate: e.target.value }))} className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-2" />
          <select value={form.locationId} onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))} className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-2">
            <option value="">Без объекта</option>
            {(locationsQuery.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-xs text-[var(--color-text-dim)]">
              Начало
              <input type="time" value={form.call} onChange={(e) => setForm((f) => ({ ...f, call: e.target.value }))} className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-2 py-1.5" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-text-dim)]">
              Обед
              <input type="time" value={form.lunch} onChange={(e) => setForm((f) => ({ ...f, lunch: e.target.value }))} className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-2 py-1.5" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-text-dim)]">
              Стоп
              <input type="time" value={form.wrap} onChange={(e) => setForm((f) => ({ ...f, wrap: e.target.value }))} className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-2 py-1.5" />
            </label>
          </div>
          <button
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="tap-target rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-[var(--color-accent-text)] disabled:opacity-60"
          >
            Создать смену
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {(shiftsQuery.data ?? [])
          .slice()
          .sort((a, b) => b.shift_date.localeCompare(a.shift_date))
          .map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-3 text-sm">
              <div>
                <div className="font-medium">
                  №{s.shift_number} · {s.shift_date}
                </div>
                <div className="text-xs text-[var(--color-text-faint)]">{s.status}</div>
              </div>
              {s.id === project.current_shift_id && <span className="rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-xs text-[var(--color-accent)]">текущая</span>}
              <button
                onClick={() => {
                  setViewingShift(s.id)
                  navigate('../today')
                }}
                className="tap-target rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs"
              >
                Смотреть
              </button>
            </li>
          ))}
        {(shiftsQuery.data ?? []).length === 0 && <p className="text-sm text-[var(--color-text-faint)]">Смен пока нет.</p>}
      </ul>
    </div>
  )
}
