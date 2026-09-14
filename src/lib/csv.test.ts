import { describe, it, expect } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('квотирует поля с запятыми, кавычками и переносами', () => {
    const csv = toCsv([['Иванов, Пётр', 'Реплика: "привет"\nвторая строка']])
    expect(csv).toContain('"Иванов, Пётр"')
    expect(csv).toContain('"Реплика: ""привет""\nвторая строка"')
  })

  it('сохраняет кириллицу как есть', () => {
    const csv = toCsv([['Объект', 'Сцена 12А, ИНТ. КВАРТИРА']])
    expect(csv).toContain('Объект')
    expect(csv).toContain('Сцена 12А, ИНТ. КВАРТИРА')
  })

  it('экранирует потенциальные формулы, чтобы защитить CSV от инъекций', () => {
    const csv = toCsv([['=SUM(A1:A2)', '+1', '-1', '@cmd', 'normal']])
    const cells = csv.replace('﻿', '').split(',')
    expect(cells[0]).toBe("'=SUM(A1:A2)")
    expect(cells[1]).toBe("'+1")
    expect(cells[2]).toBe("'-1")
    expect(cells[3]).toBe("'@cmd")
    expect(cells[4]).toBe('normal')
  })

  it('добавляет BOM для корректного открытия в Excel', () => {
    const csv = toCsv([['a']])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })
})
