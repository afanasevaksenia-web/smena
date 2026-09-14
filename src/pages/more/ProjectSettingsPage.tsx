import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useProjectContext } from '../../context/ProjectContext'
import { updateProject } from '../../api/projects'
import type { OvertimeSettings } from '../../lib/time'
import { DEFAULT_OVERTIME_SETTINGS } from '../../lib/time'

export default function ProjectSettingsPage() {
  const { project } = useProjectContext()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState(project.name)
  const [locationName, setLocationName] = useState(project.location_name ?? '')
  const settings = (project.settings as unknown as OvertimeSettings) ?? DEFAULT_OVERTIME_SETTINGS
  const [overtimeBasis, setOvertimeBasis] = useState(settings.overtimeBasis)
  const [breakMinutes, setBreakMinutes] = useState(settings.breakMinutes)
  const [breakDeductible, setBreakDeductible] = useState(settings.breakDeductible)

  const saveMutation = useMutation({
    mutationFn: () =>
      updateProject(project.id, {
        name,
        location_name: locationName || null,
        settings: { overtimeBasis, breakMinutes, breakDeductible },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', project.id] }),
  })

  const archiveMutation = useMutation({
    mutationFn: () => updateProject(project.id, { status: project.status === 'active' ? 'archived' : 'active' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', project.id] })
      if (project.status === 'active') navigate('/welcome')
    },
  })

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <h1 className="text-xl font-semibold">Настройки проекта</h1>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--color-text-dim)]">Название</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--color-text-dim)]">Место съёмки</span>
          <input value={locationName} onChange={(e) => setLocationName(e.target.value)} className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-2" />
        </label>

        <div className="mt-2 text-sm font-medium">Правила расчёта переработки</div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--color-text-dim)]">Конец работы считается по</span>
          <select value={overtimeBasis} onChange={(e) => setOvertimeBasis(e.target.value as OvertimeSettings['overtimeBasis'])} className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-2">
            <option value="work_stop">Фактическому стопу работы (по умолчанию)</option>
            <option value="departure">Отъезду, если стоп не указан</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={breakDeductible} onChange={(e) => setBreakDeductible(e.target.checked)} />
          Вычитать перерыв из отработанного времени
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--color-text-dim)]">Длительность перерыва (минут)</span>
          <input
            type="number"
            min={0}
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value))}
            className="tap-target w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-2"
          />
        </label>

        <button
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="tap-target mt-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-[var(--color-accent-text)] disabled:opacity-60"
        >
          Сохранить
        </button>
      </div>

      <button
        onClick={() => {
          if (confirm(project.status === 'active' ? 'Архивировать проект?' : 'Вернуть проект из архива?')) archiveMutation.mutate()
        }}
        className="tap-target rounded-xl border border-[var(--color-border)] px-4 py-3 text-center text-sm text-[var(--color-text-dim)]"
      >
        {project.status === 'active' ? 'Архивировать проект' : 'Вернуть из архива'}
      </button>
    </div>
  )
}
