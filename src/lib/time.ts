// Pure, timezone-aware time helpers: shift status history, scene ordering
// across midnight, and overtime calculation. Kept side-effect free so the
// rules (especially "переработка") can be unit tested directly (see
// src/lib/time.test.ts) instead of only eyeballed in the UI.

import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

export type OvertimeBasis = 'work_stop' | 'departure'

export interface OvertimeSettings {
  overtimeBasis: OvertimeBasis
  breakMinutes: number
  breakDeductible: boolean
}

export const DEFAULT_OVERTIME_SETTINGS: OvertimeSettings = {
  overtimeBasis: 'work_stop',
  breakMinutes: 60,
  breakDeductible: true,
}

export interface WorkedTimeInput {
  callTime: string | null
  actualArrival: string | null
  actualWorkStop: string | null
  actualDeparture: string | null
  plannedWrap: string | null
}

export interface WorkedTimeResult {
  /** Тот момент, что использован как конец работы для расчётов (стоп либо отъезд). */
  workEndSource: 'work_stop' | 'departure' | null
  workedMinutes: number | null
  overtimeMinutes: number | null
  /** true, если данных достаточно только для отображения, но не для расчёта переработки. */
  incomplete: boolean
  error: string | null
}

/**
 * Считает отработанное время и переработку по чётким, настраиваемым правилам:
 * - по умолчанию конец работы = actual_work_stop;
 * - если стоп не проставлен, можно посчитать по actual_departure (это явно
 *   помечается через workEndSource, чтобы отчёт не выдавал это за факт стопа);
 * - время между стопом и отъездом НИКОГДА не прибавляется автоматически;
 * - перерыв вычитается только если breakDeductible=true и фактически попадает
 *   в отработанный интервал.
 */
export function computeWorkedTime(
  input: WorkedTimeInput,
  settings: OvertimeSettings = DEFAULT_OVERTIME_SETTINGS,
): WorkedTimeResult {
  const arrival = input.actualArrival ? new Date(input.actualArrival) : null
  if (!arrival) {
    return { workEndSource: null, workedMinutes: null, overtimeMinutes: null, incomplete: true, error: null }
  }

  let end: Date | null = null
  let source: WorkedTimeResult['workEndSource'] = null

  if (input.actualWorkStop) {
    end = new Date(input.actualWorkStop)
    source = 'work_stop'
  } else if (settings.overtimeBasis === 'departure' && input.actualDeparture) {
    end = new Date(input.actualDeparture)
    source = 'departure'
  }

  if (!end) {
    return { workEndSource: null, workedMinutes: null, overtimeMinutes: null, incomplete: true, error: null }
  }

  const rawMinutes = (end.getTime() - arrival.getTime()) / 60000
  if (rawMinutes < 0) {
    return {
      workEndSource: source,
      workedMinutes: null,
      overtimeMinutes: null,
      incomplete: false,
      error: 'Окончание раньше прибытия — проверьте дату (возможен переход через полночь).',
    }
  }

  const deduction = settings.breakDeductible ? Math.min(settings.breakMinutes, rawMinutes) : 0
  const workedMinutes = Math.max(0, Math.round(rawMinutes - deduction))

  let overtimeMinutes: number | null = null
  if (input.plannedWrap) {
    const plannedEnd = new Date(input.plannedWrap)
    const plannedRaw = (plannedEnd.getTime() - arrival.getTime()) / 60000
    if (plannedRaw >= 0) {
      const plannedDeduction = settings.breakDeductible ? Math.min(settings.breakMinutes, plannedRaw) : 0
      const plannedMinutes = Math.max(0, plannedRaw - plannedDeduction)
      overtimeMinutes = Math.max(0, Math.round(workedMinutes - plannedMinutes))
    }
  }

  return { workEndSource: source, workedMinutes, overtimeMinutes, incomplete: false, error: null }
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

export interface SceneLike {
  id: string
  scheduledTime: string | null
}

/**
 * Сортирует сцены смены относительно её начала (call_time), а не относительно
 * полуночи — так ночные смены (23:00 → 06:00) идут по порядку, а не
 * разрываются на "начало суток". Сцены без времени — в конец, в исходном
 * порядке (order_hint).
 */
export function sortScenesByShiftStart<T extends SceneLike>(scenes: T[], shiftStartIso: string | null): T[] {
  if (!shiftStartIso) return [...scenes]
  const start = new Date(shiftStartIso).getTime()
  const withTime: Array<{ scene: T; offset: number }> = []
  const withoutTime: T[] = []

  for (const scene of scenes) {
    if (!scene.scheduledTime) {
      withoutTime.push(scene)
      continue
    }
    let offset = new Date(scene.scheduledTime).getTime() - start
    // переход через полночь: если время формально "раньше" старта смены
    // менее чем на 12 часов, считаем что это уже следующие сутки съёмки
    if (offset < 0 && offset > -12 * 60 * 60 * 1000) {
      offset += 24 * 60 * 60 * 1000
    }
    withTime.push({ scene, offset })
  }

  withTime.sort((a, b) => a.offset - b.offset)
  return [...withTime.map((x) => x.scene), ...withoutTime]
}

export function formatInProjectTimeZone(iso: string | null, timeZone: string, fmt = 'HH:mm'): string {
  if (!iso) return '—'
  return formatInTimeZone(new Date(iso), timeZone, fmt)
}

export function nowInTimeZone(timeZone: string): Date {
  return toZonedTime(new Date(), timeZone)
}
