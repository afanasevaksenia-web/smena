import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useProjectContext } from '../../context/ProjectContext'
import { useAuth } from '../../state/auth'
import { roleAtLeast } from '../../api/projects'
import { listBoardEvents, postBoardEvent, type BoardEvent } from '../../api/board'
import { enqueue } from '../../lib/offline/outbox'
import { formatInProjectTimeZone } from '../../lib/time'

const TYPE_LABELS: Record<BoardEvent['type'], string> = {
  note: 'Заметка',
  change: 'Изменение',
  lunch: 'Обед',
  weather: 'Погода',
}

export default function Board() {
  const { project, viewingShift, myRole } = useProjectContext()
  const user = useAuth((s) => s.user)
  const qc = useQueryClient()
  const canPostSchedule = roleAtLeast(myRole, 'coordinator')
  const [type, setType] = useState<BoardEvent['type']>('note')
  const [text, setText] = useState('')

  const eventsQuery = useQuery({
    queryKey: ['board', viewingShift?.id],
    queryFn: () => listBoardEvents(viewingShift!.id),
    enabled: !!viewingShift,
  })

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user || !viewingShift || !text.trim()) return
      const clientOpId = crypto.randomUUID()
      const payload = { projectId: project.id, shiftId: viewingShift.id, type, text: text.trim(), authorId: user.id }
      try {
        await postBoardEvent({ ...payload, clientOpId })
      } catch (err) {
        await enqueue('post_board_event', payload, clientOpId)
        if (!navigator.onLine) return
        throw err
      }
    },
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['board', viewingShift?.id] })
    },
  })

  const tz = viewingShift?.timezone ?? 'Europe/Moscow'
  const availableTypes: BoardEvent['type'][] = canPostSchedule ? ['note', 'change', 'lunch', 'weather'] : ['note', 'weather']

  if (!viewingShift) {
    return <div className="p-4 text-[var(--color-text-dim)]">Нет активной смены.</div>
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <h1 className="text-xl font-semibold">Доска дня — смена №{viewingShift.shift_number}</h1>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-3">
        <div className="mb-2 flex gap-2">
          {availableTypes.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`tap-target rounded-full px-3 py-1 text-xs font-medium ${
                type === t ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]' : 'bg-[var(--color-bg-sunken)] text-[var(--color-text-dim)]'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Что произошло?"
            className="tap-target flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <button
            disabled={!text.trim() || postMutation.isPending}
            onClick={() => postMutation.mutate()}
            className="tap-target rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-text)] disabled:opacity-50"
          >
            Добавить
          </button>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {(eventsQuery.data ?? []).map((ev) => (
          <li key={ev.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-3 text-sm">
            <div className="mb-1 flex items-center gap-2 text-xs text-[var(--color-text-faint)]">
              <span className="rounded-full bg-[var(--color-bg-sunken)] px-2 py-0.5">{TYPE_LABELS[ev.type]}</span>
              <span>{formatInProjectTimeZone(ev.created_at, tz, 'd MMM, HH:mm')}</span>
            </div>
            <div>{ev.text}</div>
          </li>
        ))}
        {(eventsQuery.data ?? []).length === 0 && <p className="text-sm text-[var(--color-text-faint)]">Записей пока нет.</p>}
      </ul>
    </div>
  )
}
