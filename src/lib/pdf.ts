// Генерация настоящего PDF (не print-to-pdf) с кириллицей через pdfmake.
// Roboto действительно поддерживает кириллицу — грузим TTF из /public/fonts
// и регистрируем как виртуальную файловую систему pdfmake в браузере.

let vfsReady: Promise<void> | null = null

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Не удалось загрузить шрифт ${url}`)
  const buf = await res.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

async function getPdfMake() {
  const mod = await import('pdfmake/build/pdfmake.js')
  const pdfMake = ((mod as { default?: unknown }).default ?? mod) as {
    addVirtualFileSystem: (vfs: Record<string, string>) => void
    createPdf: (docDefinition: unknown) => { download: (filename: string) => Promise<void>; open: () => Promise<void> }
  }

  if (!vfsReady) {
    vfsReady = (async () => {
      const files = ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Italic.ttf', 'Roboto-MediumItalic.ttf']
      const entries = await Promise.all(files.map(async (f) => [f, await fetchAsBase64(`/fonts/Roboto/${f}`)] as const))
      pdfMake.addVirtualFileSystem(Object.fromEntries(entries))
    })()
  }
  await vfsReady
  return pdfMake
}

export interface CallSheetPdfData {
  projectName: string
  shiftNumber: number
  shiftDate: string
  locationName: string | null
  address: string | null
  callTime: string
  lunchTime: string
  plannedWrap: string
  notes: string | null
  scenes: { number: string; time: string; locationText: string; dayNight: string; fullText?: string }[]
  crew: { name: string; department: string; phone: string; callTime: string }[]
  actors: { name: string; department: string; phone: string; callTime: string }[]
  transport: { name: string; department: string; phone: string; callTime: string }[]
  full: boolean
}

function peopleTable(title: string, rows: CallSheetPdfData['crew']) {
  if (rows.length === 0) return []
  return [
    { text: title, style: 'sectionHeader', margin: [0, 10, 0, 4] as [number, number, number, number] },
    {
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto'],
        body: [
          [{ text: 'Имя', style: 'th' }, { text: 'Цех/роль', style: 'th' }, { text: 'Вызов', style: 'th' }, { text: 'Телефон', style: 'th' }],
          ...rows.map((r) => [r.name, r.department, r.callTime, r.phone]),
        ],
      },
      layout: 'lightHorizontalLines',
    },
  ]
}

export async function generateCallSheetPdf(data: CallSheetPdfData): Promise<void> {
  const pdfMake = await getPdfMake()

  const content: unknown[] = [
    { text: 'ВЫЗЫВНОЙ ЛИСТ', style: 'title' },
    { text: data.projectName, style: 'subtitle' },
    {
      columns: [
        { text: `Смена №${data.shiftNumber} · ${data.shiftDate}`, style: 'meta' },
        { text: `Начало ${data.callTime} · Обед ${data.lunchTime} · Стоп ${data.plannedWrap}`, style: 'meta', alignment: 'right' },
      ],
    },
    data.locationName ? { text: `Объект: ${data.locationName}${data.address ? ', ' + data.address : ''}`, margin: [0, 6, 0, 0] } : {},
    { text: 'Сцены', style: 'sectionHeader', margin: [0, 12, 0, 4] },
    {
      table: {
        headerRows: 1,
        widths: ['auto', 'auto', '*', 'auto'],
        body: [
          [{ text: '№', style: 'th' }, { text: 'Время', style: 'th' }, { text: 'Локация', style: 'th' }, { text: 'День/ночь', style: 'th' }],
          ...data.scenes.map((s) => [s.number, s.time, s.locationText, s.dayNight]),
        ],
      },
      layout: 'lightHorizontalLines',
    },
  ]

  if (data.full) {
    for (const s of data.scenes) {
      if (!s.fullText) continue
      content.push(
        { text: `Сцена ${s.number}`, style: 'sectionHeader', margin: [0, 10, 0, 2], pageBreak: 'before' as const },
        { text: s.fullText, style: 'sceneText' },
      )
    }
  }

  content.push(...peopleTable('Группа', data.crew), ...peopleTable('Актёры', data.actors), ...peopleTable('Транспорт', data.transport))

  if (data.notes) {
    content.push({ text: 'Примечания', style: 'sectionHeader', margin: [0, 10, 0, 4] }, { text: data.notes })
  }

  const docDefinition = {
    content,
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    styles: {
      title: { fontSize: 16, bold: true },
      subtitle: { fontSize: 12, margin: [0, 2, 0, 6] as [number, number, number, number] },
      meta: { fontSize: 9, color: '#444444' },
      sectionHeader: { fontSize: 11, bold: true },
      th: { bold: true, fillColor: '#eeeeee' },
      sceneText: { fontSize: 9, lineHeight: 1.3 },
    },
    pageMargins: [32, 32, 32, 32] as [number, number, number, number],
  }

  const pdf = pdfMake.createPdf(docDefinition)
  await pdf.download(`vyzyvnoi-smena-${data.shiftNumber}.pdf`)
}
