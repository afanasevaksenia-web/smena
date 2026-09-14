import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useProjectContext } from '../../context/ProjectContext'
import { roleAtLeast } from '../../api/projects'
import { listLocations, createLocation, updateLocation } from '../../api/locations'
import { listScenes } from '../../api/scenes'
import { downloadCsv } from '../../lib/csv'

export default function LocationsPage() {
  const { project, myRole } = useProjectContext()
  const canEdit = roleAtLeast(myRole, 'coordinator')
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', groupName: '', address: '', directions: '', parking: '', notes: '' })

  const locationsQuery = useQuery({ queryKey: ['locations', project.id], queryFn: () => listLocations(project.id) })
  const scenesQuery = useQuery({ queryKey: ['scenes', project.id], queryFn: () => listScenes(project.id) })

  const sceneCountByLocation = useMemo(() => {
    const map = new Map<string, { total: number; shot: number }>()
    for (const s of scenesQuery.data ?? []) {
      if (!s.location_id) continue
      const entry = map.get(s.location_id) ?? { total: 0, shot: 0 }
      entry.total += 1
      if (s.shot) entry.shot += 1
      map.set(s.location_id, entry)
    }
    return map
  }, [scenesQuery.data])

  const createMutation = useMutation({
    mutationFn: () =>
      createLocation({
        projectId: project.id,
        name: form.name,
        groupName: form.groupName || null,
        address: form.address || null,
        directions: form.directions || null,
        parking: form.parking || null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations', project.id] })
      setForm({ name: '', groupName: '', address: '', directions: '', parking: '', notes: '' })
      setCreating(false)
    },
  })

  const filtered = (locationsQuery.data ?? []).filter((l) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return l.name.toLowerCase().includes(q) || (l.address ?? '').toLowerCase().includes(q) || (l.group_name ?? '').toLowerCase().includes(q)
  })

  function exportCsv() {
    const rows: unknown[][] = [['Название', 'Группа', 'Адрес', 'Проезд', 'Парковка', 'Сцены (снято/всего)']]
    for (const l of filtered) {
      const counts = sceneCountByLocation.get(l.id)
      rows.push([l.name, l.group_name ?? '', l.address ?? '', l.directions ?? '', l.parking ?? '', counts ? `${counts.shot}/${counts.total}` : '0/0'])
    }
    downloadCsv('obekty', rows)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Объекты съёмки</h1>
        {canEdit && (
          <button onClick={() => setCreating((v) => !v)} className="tap-target rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-text)]">
            + Объект
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск"
          className="tap-target flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <button onClick={exportCsv} className="tap-target rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
          Экспорт CSV
        </button>
      </div>

      {creating && (
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-3">
          {(['name', 'groupName', 'address', 'directions', 'parking', 'notes'] as const).map((field) => (
            <input
              key={field}
              value={form[field]}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              placeholder={{ name: 'Название', groupName: 'Группа объектов', address: 'Адрес', directions: 'Проезд', parking: 'Парковка', notes: 'Примечания' }[field]}
              className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          ))}
          <button
            disabled={!form.name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="tap-target rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-text)] disabled:opacity-60"
          >
            Сохранить
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {filtered.map((l) => {
          const counts = sceneCountByLocation.get(l.id)
          return (
            <li key={l.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{l.name}</div>
                  {l.group_name && <div className="text-xs text-[var(--color-text-faint)]">{l.group_name}</div>}
                </div>
                <div className="text-xs text-[var(--color-text-dim)]">{counts ? `${counts.shot}/${counts.total} сцен` : ''}</div>
              </div>
              {l.address && <div className="mt-1 text-[var(--color-text-dim)]">{l.address}</div>}
              <div className="mt-2 flex flex-wrap gap-2">
                {l.address && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(l.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tap-target rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-accent)]"
                  >
                    Открыть на карте
                  </a>
                )}
              </div>
              {canEdit && <InlineEditFields location={l} onSaved={() => qc.invalidateQueries({ queryKey: ['locations', project.id] })} />}
            </li>
          )
        })}
        {filtered.length === 0 && <p className="text-sm text-[var(--color-text-faint)]">Объекты не найдены.</p>}
      </ul>
    </div>
  )
}

function InlineEditFields({ location, onSaved }: { location: { id: string; directions: string | null; parking: string | null; notes: string | null }; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [directions, setDirections] = useState(location.directions ?? '')
  const [parking, setParking] = useState(location.parking ?? '')
  const [notes, setNotes] = useState(location.notes ?? '')
  const mutation = useMutation({
    mutationFn: () => updateLocation(location.id, { directions: directions || null, parking: parking || null, notes: notes || null }),
    onSuccess: onSaved,
  })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-xs text-[var(--color-text-faint)] underline-offset-2 hover:underline">
        Проезд / парковка / примечания
      </button>
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <input value={directions} onChange={(e) => setDirections(e.target.value)} placeholder="Проезд" className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-1.5 text-xs" />
      <input value={parking} onChange={(e) => setParking(e.target.value)} placeholder="Парковка" className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-1.5 text-xs" />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Примечания" className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-1.5 text-xs" />
      <button onClick={() => mutation.mutate()} className="tap-target self-start rounded-lg bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-[var(--color-accent-text)]">
        Сохранить
      </button>
    </div>
  )
}
