import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useProjectContext } from '../../context/ProjectContext'
import { useAuth } from '../../state/auth'
import { roleAtLeast } from '../../api/projects'
import { setShiftStatus, setMyShiftStatus, listMemberShiftStatuses, type ShiftStatus, type MemberStatus } from '../../api/shifts'
import { listScenes } from '../../api/scenes'
import { listAssignments } from '../../api/assignments'
import { listBoardEvents } from '../../api/board'
import { sortScenesByShiftStart, formatInProjectTimeZone } from '../../lib/time'

const STATUS_LABELS: Record<ShiftStatus, string> = {
  подготовка: 'Подготовка',
  мотор: 'Мотор',
  обед: 'Обед',
  стоп: 'Стоп',
}
const STATUS_ORDER: ShiftStatus[] = ['подготовка', 'мотор', 'обед', 'стоп']

const MY_STATUS_LABELS: Record<MemberStatus, string> = {
  not_seen: 'Не видел',
  seen: 'Видел',
  on_way: 'Еду',
  on_site: 'На площадке',
}
const MY_STATUS_ORDER: MemberStatus[] = ['not_seen', 'seen', 'on_way', 'on_site']

export default function Today() {
  const { project, viewingShift, myRole } = useProjectContext()
  const user = useAuth((s) => s.user)
  const qc = useQueryClient()
  const canChangeShiftStatus = roleAtLeast(myRole, 'coordinator')

  const scenesQuery = useQuery({
    queryKey: ['scenes', project.id],
    queryFn: () => listScenes(project.id),
    enabled: !!viewingShift,
  })
  const assignmentsQuery = useQuery({
    queryKey: ['assignments', viewingShift?.id],
    queryFn: () => listAssignments(viewingShift!.id),
    enabled: !!viewingShift,
  })
  const boardQuery = useQuery({
    queryKey: ['board', viewingShift?.id],
    queryFn: () => listBoardEvents(viewingShift!.id),
    enabled: !!viewingShift,
  })
  const memberStatusQuery = useQuery({
    queryKey: ['member-shift-status', viewingShift?.id],
    queryFn: () => listMemberShiftStatuses(viewingShift!.id),
    enabled: !!viewingShift,
  })

  const shiftScenes = useMemo(() => {
    const all = (scenesQuery.data ?? []).filter((s) => s.shift_id === viewingShift?.id)
    return sortScenesByShiftStart(
      all.map((s) => ({ ...s, scheduledTime: s.scheduled_time })),
      viewingShift?.call_time ?? null,
    )
  }, [scenesQuery.data, viewingShift])

  const shotCount = shiftScenes.filter((s) => s.shot).length
  const onSiteCount = (assignmentsQuery.data ?? []).filter((a) => a.actual_arrival && !a.actual_departure).length

  const statusMutation = useMutation({
    mutationFn: (status: ShiftStatus) => setShiftStatus(viewingShift!.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift', viewingShift?.id] })
      qc.invalidateQueries({ queryKey: ['project', project.id] })
    },
  })

  const myStatus = memberStatusQuery.data?.find((m) => m.user_id === user?.id)?.status ?? 'not_seen'
  const myStatusMutation = useMutation({
    mutationFn: (status: MemberStatus) => setMyShiftStatus(viewingShift!.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-shift-status', viewingShift?.id] }),
  })

  if (!viewingShift) {
    return (
      <div className="p-4">
        <EmptyShiftState canManage={canChangeShiftStatus} projectId={project.id} />
      </div>
    )
  }

  const tz = viewingShift.timezone

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <header>
        <div className="text-sm text-[var(--color-text-dim)]">{project.name}</div>
        <h1 className="text-xl font-semibold">
          Смена №{viewingShift.shift_number} · {viewingShift.shift_date}
        </h1>
      </header>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {STATUS_ORDER.map((status) => {
            const active = viewingShift.status === status
            return (
              <button
                key={status}
                type="button"
                disabled={!canChangeShiftStatus || statusMutation.isPending}
                onClick={() => statusMutation.mutate(status)}
                aria-pressed={active}
                className={`tap-target rounded-full border px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${
                  active
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-text)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-dim)]'
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            )
          })}
        </div>
        <div className="text-xs text-[var(--color-text-faint)]">
          Изменено {formatInProjectTimeZone(viewingShift.status_changed_at, tz, 'd MMM, HH:mm')}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Начало" value={formatInProjectTimeZone(viewingShift.call_time, tz)} />
          <Stat label="Обед" value={formatInProjectTimeZone(viewingShift.lunch_time, tz)} />
          <Stat label="Плановый стоп" value={formatInProjectTimeZone(viewingShift.planned_wrap, tz)} />
          <Stat label="На площадке" value={String(onSiteCount)} />
        </dl>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4">
        <div className="mb-2 text-sm text-[var(--color-text-dim)]">Мой статус</div>
        <div className="flex flex-wrap gap-2">
          {MY_STATUS_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => myStatusMutation.mutate(status)}
              disabled={myStatusMutation.isPending}
              aria-pressed={myStatus === status}
              className={`tap-target rounded-full border px-3 py-1.5 text-sm disabled:opacity-50 ${
                myStatus === status
                  ? 'border-[var(--color-info)] bg-[var(--color-info)]/15 text-[var(--color-info)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-dim)]'
              }`}
            >
              {MY_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">
            Сцены дня · {shotCount}/{shiftScenes.length}
          </h2>
          <Link to="../callsheet" className="text-sm text-[var(--color-accent)]">
            Вызывной →
          </Link>
        </div>
        {shiftScenes.length === 0 ? (
          <p className="text-sm text-[var(--color-text-faint)]">На эту смену пока не назначены сцены.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-border)]">
            {shiftScenes.map((scene) => (
              <li key={scene.id} className="flex items-center gap-3 py-2 text-sm">
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${scene.shot ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-text-faint)]'}`}
                />
                <span className="w-14 shrink-0 tabular-nums text-[var(--color-text-dim)]">
                  {scene.scheduled_time ? formatInProjectTimeZone(scene.scheduled_time, tz) : '—'}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {scene.scene_number}. {scene.location_text ?? 'Без локации'}
                </span>
                <span className="shrink-0 text-xs text-[var(--color-text-faint)]">{scene.shot ? 'снято' : 'план'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Последние на доске</h2>
          <Link to="../board" className="text-sm text-[var(--color-accent)]">
            Все →
          </Link>
        </div>
        {(boardQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-faint)]">Пока нет записей.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(boardQuery.data ?? []).slice(0, 5).map((ev) => (
              <li key={ev.id} className="text-sm">
                <span className="text-[var(--color-text-faint)]">{formatInProjectTimeZone(ev.created_at, tz)} · </span>
                {ev.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-text-faint)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

function EmptyShiftState({ canManage, projectId }: { canManage: boolean; projectId: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center">
      <p className="mb-3 text-[var(--color-text-dim)]">В проекте ещё нет ни одной смены.</p>
      {canManage ? (
        <Link
          to={`/p/${projectId}/shifts`}
          className="tap-target inline-block rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-[var(--color-accent-text)]"
        >
          Создать первую смену
        </Link>
      ) : (
        <p className="text-sm text-[var(--color-text-faint)]">Координатор проекта скоро добавит смену.</p>
      )}
    </div>
  )
}
