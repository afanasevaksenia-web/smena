import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useProjectContext } from '../../context/ProjectContext'
import { listScenes } from '../../api/scenes'
import { listContacts } from '../../api/contacts'
import { listAssignments } from '../../api/assignments'
import { sortScenesByShiftStart, formatInProjectTimeZone } from '../../lib/time'
import { downloadCsv } from '../../lib/csv'
import { generateCallSheetPdf } from '../../lib/pdf'

export default function CallSheet() {
  const { project, viewingShift } = useProjectContext()
  const [full, setFull] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  const scenesQuery = useQuery({ queryKey: ['scenes', project.id], queryFn: () => listScenes(project.id) })
  const contactsQuery = useQuery({ queryKey: ['contacts', project.id], queryFn: () => listContacts(project.id) })
  const assignmentsQuery = useQuery({
    queryKey: ['assignments', viewingShift?.id],
    queryFn: () => listAssignments(viewingShift!.id),
    enabled: !!viewingShift,
  })

  const tz = viewingShift?.timezone ?? 'Europe/Moscow'

  const scenes = useMemo(() => {
    const all = (scenesQuery.data ?? []).filter((s) => s.shift_id === viewingShift?.id)
    return sortScenesByShiftStart(
      all.map((s) => ({ ...s, scheduledTime: s.scheduled_time })),
      viewingShift?.call_time ?? null,
    )
  }, [scenesQuery.data, viewingShift])

  const assignmentByContact = useMemo(() => {
    const map = new Map<string, { call_time: string | null }>()
    for (const a of assignmentsQuery.data ?? []) map.set(a.contact_id, a)
    return map
  }, [assignmentsQuery.data])

  const rowsFor = (category: 'crew' | 'actor' | 'transport') =>
    (contactsQuery.data ?? [])
      .filter((c) => c.category === category)
      .map((c) => ({
        name: c.full_name,
        department: c.department ?? '',
        phone: c.phone ?? '',
        callTime: formatInProjectTimeZone(assignmentByContact.get(c.id)?.call_time ?? null, tz),
      }))

  if (!viewingShift) {
    return <div className="p-4 text-[var(--color-text-dim)]">Нет активной смены — вызывной формировать не из чего.</div>
  }

  const crew = rowsFor('crew')
  const actors = rowsFor('actor')
  const transport = rowsFor('transport')

  function buildTextVersion(): string {
    const lines: string[] = []
    lines.push(`ВЫЗЫВНОЙ ЛИСТ — ${project.name}`)
    lines.push(`Смена №${viewingShift!.shift_number} · ${viewingShift!.shift_date}`)
    lines.push(`Начало: ${formatInProjectTimeZone(viewingShift!.call_time, tz)} · Обед: ${formatInProjectTimeZone(viewingShift!.lunch_time, tz)} · Стоп: ${formatInProjectTimeZone(viewingShift!.planned_wrap, tz)}`)
    lines.push('')
    lines.push('СЦЕНЫ:')
    for (const s of scenes) {
      lines.push(`${s.scene_number}  ${s.scheduled_time ? formatInProjectTimeZone(s.scheduled_time, tz) : '—'}  ${s.location_text ?? ''} (${s.day_night ?? ''})`)
    }
    if (crew.length) {
      lines.push('', 'ГРУППА:')
      for (const c of crew) lines.push(`${c.name} — ${c.department} — ${c.callTime} — ${c.phone}`)
    }
    if (actors.length) {
      lines.push('', 'АКТЁРЫ:')
      for (const c of actors) lines.push(`${c.name} — ${c.department} — ${c.callTime} — ${c.phone}`)
    }
    if (transport.length) {
      lines.push('', 'ТРАНСПОРТ:')
      for (const c of transport) lines.push(`${c.name} — ${c.department} — ${c.callTime} — ${c.phone}`)
    }
    if (viewingShift!.notes) lines.push('', 'ПРИМЕЧАНИЯ:', viewingShift!.notes)
    return lines.join('\n')
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildTextVersion())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDownloadPdf() {
    setPdfBusy(true)
    try {
      await generateCallSheetPdf({
        projectName: project.name,
        shiftNumber: viewingShift!.shift_number,
        shiftDate: viewingShift!.shift_date,
        locationName: project.location_name,
        address: null,
        callTime: formatInProjectTimeZone(viewingShift!.call_time, tz),
        lunchTime: formatInProjectTimeZone(viewingShift!.lunch_time, tz),
        plannedWrap: formatInProjectTimeZone(viewingShift!.planned_wrap, tz),
        notes: viewingShift!.notes,
        scenes: scenes.map((s) => ({
          number: s.scene_number,
          time: s.scheduled_time ? formatInProjectTimeZone(s.scheduled_time, tz) : '—',
          locationText: s.location_text ?? '',
          dayNight: s.day_night ?? '',
          fullText: s.full_text ?? undefined,
        })),
        crew,
        actors,
        transport,
        full,
      })
    } finally {
      setPdfBusy(false)
    }
  }

  function handleExportCsv() {
    const rows: unknown[][] = [['№', 'Время', 'Локация', 'День/ночь', 'Статус']]
    for (const s of scenes) {
      rows.push([s.scene_number, s.scheduled_time ? formatInProjectTimeZone(s.scheduled_time, tz) : '', s.location_text ?? '', s.day_night ?? '', s.shot ? 'снято' : 'план'])
    }
    downloadCsv(`plan-dnya-smena-${viewingShift!.shift_number}`, rows)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Вызывной</h1>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-dim)]">
          <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} />
          Полная версия (с текстом сцен)
        </label>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <button onClick={() => window.print()} className="tap-target rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
          Печать
        </button>
        <button onClick={handleDownloadPdf} disabled={pdfBusy} className="tap-target rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent-text)] disabled:opacity-60">
          {pdfBusy ? 'Готовим PDF…' : 'Скачать PDF'}
        </button>
        <button onClick={handleCopy} className="tap-target rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
          {copied ? 'Скопировано ✓' : 'Копировать текст'}
        </button>
        <button onClick={handleExportCsv} className="tap-target rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
          Экспорт плана в CSV
        </button>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 text-black print:border-0">
        <h2 className="text-lg font-bold">{project.name}</h2>
        <p className="text-sm">
          Смена №{viewingShift.shift_number} · {viewingShift.shift_date} · {project.location_name}
        </p>
        <p className="text-sm">
          Начало {formatInProjectTimeZone(viewingShift.call_time, tz)} · Обед {formatInProjectTimeZone(viewingShift.lunch_time, tz)} · Стоп{' '}
          {formatInProjectTimeZone(viewingShift.planned_wrap, tz)}
        </p>

        <h3 className="mt-4 font-semibold">Сцены</h3>
        <table className="w-full text-sm">
          <tbody>
            {scenes.map((s) => (
              <tr key={s.id} className="border-t border-gray-200">
                <td className="py-1 pr-2">{s.scene_number}</td>
                <td className="py-1 pr-2">{s.scheduled_time ? formatInProjectTimeZone(s.scheduled_time, tz) : '—'}</td>
                <td className="py-1 pr-2">{s.location_text}</td>
                <td className="py-1">{s.day_night}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {full &&
          scenes
            .filter((s) => s.full_text)
            .map((s) => (
              <div key={s.id} className="mt-3 whitespace-pre-wrap text-sm">
                <strong>Сцена {s.scene_number}</strong>
                <div>{s.full_text}</div>
              </div>
            ))}

        <PeopleBlock title="Группа" rows={crew} />
        <PeopleBlock title="Актёры" rows={actors} />
        <PeopleBlock title="Транспорт" rows={transport} />

        {viewingShift.notes && (
          <>
            <h3 className="mt-4 font-semibold">Примечания</h3>
            <p className="text-sm">{viewingShift.notes}</p>
          </>
        )}
      </div>
    </div>
  )
}

function PeopleBlock({ title, rows }: { title: string; rows: { name: string; department: string; phone: string; callTime: string }[] }) {
  if (rows.length === 0) return null
  return (
    <>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-200">
              <td className="py-1 pr-2">{r.name}</td>
              <td className="py-1 pr-2">{r.department}</td>
              <td className="py-1 pr-2">{r.callTime}</td>
              <td className="py-1">
                <a href={`tel:${r.phone}`} className="text-blue-700">
                  {r.phone}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
