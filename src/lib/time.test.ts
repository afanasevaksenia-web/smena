import { describe, it, expect } from 'vitest'
import { computeWorkedTime, sortScenesByShiftStart, formatMinutes } from './time'

describe('computeWorkedTime', () => {
  it('считает отработанное время по умолчанию до фактического стопа', () => {
    const r = computeWorkedTime({
      callTime: null,
      actualArrival: '2026-03-01T06:00:00Z',
      actualWorkStop: '2026-03-01T18:00:00Z',
      actualDeparture: '2026-03-01T18:45:00Z',
      plannedWrap: null,
    })
    // 12 часов - 60 минут перерыва = 11 часов
    expect(r.workedMinutes).toBe(11 * 60)
    expect(r.workEndSource).toBe('work_stop')
  })

  it('не приплюсовывает время ожидания отъезда после стопа', () => {
    const withDeparture = computeWorkedTime({
      callTime: null,
      actualArrival: '2026-03-01T06:00:00Z',
      actualWorkStop: '2026-03-01T18:00:00Z',
      actualDeparture: '2026-03-01T20:00:00Z',
      plannedWrap: null,
    })
    const withoutDeparture = computeWorkedTime({
      callTime: null,
      actualArrival: '2026-03-01T06:00:00Z',
      actualWorkStop: '2026-03-01T18:00:00Z',
      actualDeparture: null,
      plannedWrap: null,
    })
    expect(withDeparture.workedMinutes).toBe(withoutDeparture.workedMinutes)
  })

  it('может считать по отъезду, если стоп не указан и это явно настроено', () => {
    const r = computeWorkedTime(
      {
        callTime: null,
        actualArrival: '2026-03-01T06:00:00Z',
        actualWorkStop: null,
        actualDeparture: '2026-03-01T18:00:00Z',
        plannedWrap: null,
      },
      { overtimeBasis: 'departure', breakMinutes: 60, breakDeductible: true },
    )
    expect(r.workEndSource).toBe('departure')
    expect(r.workedMinutes).toBe(11 * 60)
  })

  it('без прибытия — неполные данные, без ошибки', () => {
    const r = computeWorkedTime({
      callTime: null,
      actualArrival: null,
      actualWorkStop: '2026-03-01T18:00:00Z',
      actualDeparture: null,
      plannedWrap: null,
    })
    expect(r.incomplete).toBe(true)
    expect(r.workedMinutes).toBeNull()
  })

  it('обрабатывает ночную смену без отрицательных интервалов', () => {
    // заезд поздно вечером, стоп рано утром следующего дня — оба ISO абсолютны, интервал положительный
    const r = computeWorkedTime({
      callTime: null,
      actualArrival: '2026-03-01T22:00:00Z',
      actualWorkStop: '2026-03-02T06:00:00Z',
      actualDeparture: null,
      plannedWrap: null,
    })
    expect(r.error).toBeNull()
    expect(r.workedMinutes).toBe(7 * 60) // 8 часов - 60 минут перерыва
  })

  it('сообщает об ошибке, если окончание раньше прибытия (перепутана дата)', () => {
    const r = computeWorkedTime({
      callTime: null,
      actualArrival: '2026-03-02T06:00:00Z',
      actualWorkStop: '2026-03-01T22:00:00Z',
      actualDeparture: null,
      plannedWrap: null,
    })
    expect(r.error).toBeTruthy()
    expect(r.workedMinutes).toBeNull()
  })

  it('считает переработку относительно планового стопа', () => {
    const r = computeWorkedTime({
      callTime: null,
      actualArrival: '2026-03-01T08:00:00Z',
      actualWorkStop: '2026-03-01T21:00:00Z',
      actualDeparture: null,
      plannedWrap: '2026-03-01T20:00:00Z',
    })
    // план: 12ч - 1ч перерыв = 11ч; факт: 13ч - 1ч = 12ч => 1ч переработки
    expect(r.overtimeMinutes).toBe(60)
  })
})

describe('sortScenesByShiftStart', () => {
  it('сортирует сцены относительно начала смены', () => {
    const scenes = [
      { id: 'c', scheduledTime: '2026-03-01T14:00:00Z' },
      { id: 'a', scheduledTime: '2026-03-01T09:00:00Z' },
      { id: 'b', scheduledTime: '2026-03-01T11:00:00Z' },
    ]
    const sorted = sortScenesByShiftStart(scenes, '2026-03-01T08:00:00Z')
    expect(sorted.map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('переносит сцены за полночь в конец списка относительно старта смены', () => {
    const scenes = [
      { id: 'late-night', scheduledTime: '2026-03-02T02:00:00Z' }, // ночь, после полуночи
      { id: 'evening', scheduledTime: '2026-03-01T23:00:00Z' },
      { id: 'start', scheduledTime: '2026-03-01T20:00:00Z' },
    ]
    // смена начинается в 20:00, значит 02:00 следующих суток идёт ПОСЛЕ 23:00, а не в начале
    const sorted = sortScenesByShiftStart(scenes, '2026-03-01T20:00:00Z')
    expect(sorted.map((s) => s.id)).toEqual(['start', 'evening', 'late-night'])
  })

  it('сцены без времени уходят в конец', () => {
    const scenes = [
      { id: 'no-time', scheduledTime: null },
      { id: 'timed', scheduledTime: '2026-03-01T10:00:00Z' },
    ]
    const sorted = sortScenesByShiftStart(scenes, '2026-03-01T08:00:00Z')
    expect(sorted.map((s) => s.id)).toEqual(['timed', 'no-time'])
  })

  it('без времени начала смены возвращает исходный порядок', () => {
    const scenes = [
      { id: 'a', scheduledTime: '2026-03-01T10:00:00Z' },
      { id: 'b', scheduledTime: null },
    ]
    expect(sortScenesByShiftStart(scenes, null)).toEqual(scenes)
  })
})

describe('formatMinutes', () => {
  it('форматирует как Ч:ММ', () => {
    expect(formatMinutes(90)).toBe('1:30')
    expect(formatMinutes(0)).toBe('0:00')
    expect(formatMinutes(null)).toBe('—')
  })
})
