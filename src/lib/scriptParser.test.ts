import { describe, it, expect } from 'vitest'
import { parseScript, planImport, normalizeStableKey } from './scriptParser'

describe('parseScript', () => {
  it('распознаёт русские и английские заголовки сцен', () => {
    const text = [
      '1. ИНТ. КВАРТИРА ИВАНОВЫХ - ДЕНЬ',
      'Пётр входит в комнату.',
      '',
      '2. EXT. STREET - NIGHT',
      'A car passes by.',
    ].join('\n')

    const { scenes } = parseScript(text)
    expect(scenes).toHaveLength(2)
    expect(scenes[0].sceneNumber).toBe('1')
    expect(scenes[0].intExt).toBe('INT')
    expect(scenes[0].locationText).toBe('КВАРТИРА ИВАНОВЫХ')
    expect(scenes[0].dayNight).toBe('ДЕНЬ')
    expect(scenes[1].intExt).toBe('EXT')
    expect(scenes[1].dayNight).toBe('NIGHT')
  })

  it('поддерживает номер сцены в конце строки в стиле Fountain (#12#)', () => {
    const { scenes } = parseScript('INT. HOUSE - DAY #12#\nSome action.')
    expect(scenes[0].sceneNumber).toBe('12')
    expect(scenes[0].numberInferred).toBe(false)
  })

  it('присваивает автоматический номер, если он не найден, и помечает это', () => {
    const { scenes } = parseScript('НАТ. ЛЕС - УТРО\nТишина.')
    expect(scenes[0].numberInferred).toBe(true)
    expect(scenes[0].sceneNumber).toBe('A1')
  })

  it('сохраняет исходный текст сцены дословно', () => {
    const body = '1. ИНТ. ОФИС - ДЕНЬ\nСтрока один.\nСтрока два.\n\nСтрока после пустой.'
    const { scenes } = parseScript(body)
    expect(scenes[0].fullText).toBe(body)
  })

  it('относит сцены к серии, объявленной маркером СЕРИЯ N', () => {
    const text = ['СЕРИЯ 2', '1. ИНТ. КОМНАТА - ДЕНЬ', 'Текст.'].join('\n')
    const { scenes } = parseScript(text)
    expect(scenes[0].episode).toBe('2')
    expect(scenes[0].stableKey).toBe(normalizeStableKey('2', '1'))
  })

  it('находит дубликаты номеров сцен внутри одного файла', () => {
    const text = ['1. ИНТ. А - ДЕНЬ', 'Текст А', '1. ИНТ. Б - ДЕНЬ', 'Текст Б'].join('\n')
    const { warnings } = parseScript(text)
    expect(warnings.some((w) => w.includes('Дубликат'))).toBe(true)
  })

  it('не путает реплики персонажей (капс) с нераспознанными заголовками сцен', () => {
    const text = ['1. ИНТ. КОМНАТА - ДЕНЬ', '', 'ПЁТР', 'Привет!', ''].join('\n')
    const { warnings, scenes } = parseScript(text)
    expect(warnings.filter((w) => w.includes('не распознано'))).toHaveLength(0)
    expect(scenes[0].characters).toContain('ПЁТР')
  })
})

describe('planImport', () => {
  it('новые сцены идут в create, совпавшие по ключу — в update', () => {
    const { scenes } = parseScript(['1. ИНТ. А - ДЕНЬ', 'Текст', '2. ИНТ. Б - НОЧЬ', 'Текст'].join('\n'))
    const existing = [{ id: 'existing-1', stableKey: normalizeStableKey(null, '1') }]
    const plan = planImport(existing, scenes)
    expect(plan.toCreate.map((s) => s.sceneNumber)).toEqual(['2'])
    expect(plan.toUpdate).toEqual([{ existingId: 'existing-1', parsed: scenes[0] }])
  })

  it('повторный импорт того же файла не создаёт дубликатов, а только обновления', () => {
    const { scenes } = parseScript(['1. ИНТ. А - ДЕНЬ', 'Текст'].join('\n'))
    const existing = scenes.map((s, i) => ({ id: `id-${i}`, stableKey: s.stableKey }))
    const plan = planImport(existing, scenes)
    expect(plan.toCreate).toHaveLength(0)
    expect(plan.toUpdate).toHaveLength(1)
  })
})
