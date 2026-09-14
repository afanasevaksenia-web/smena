// CSV export: RFC4180 quoting + guard against CSV formula injection
// (a cell starting with = + - @ tab or CR can execute as a formula when the
// file is opened in Excel/Sheets — a classic import/export vulnerability).

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

function escapeCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)

  if (FORMULA_PREFIXES.some((p) => text.startsWith(p))) {
    text = `'${text}`
  }

  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`
  }

  return text
}

export function toCsv(rows: unknown[][]): string {
  const body = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')
  // BOM so Excel opens UTF-8/Cyrillic correctly
  return '﻿' + body
}

export function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = toCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
