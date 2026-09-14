// Разбор сценария (TXT / Fountain-подобный текст) в сцены.
// Правило раздела 10 ТЗ: сохраняем исходный текст, не придумываем то, чего
// нет (номер серии, день/ночь и т.п. остаются null, если не распознаны).

export interface ParsedScene {
  episode: string | null
  sceneNumber: string
  numberInferred: boolean
  intExt: 'INT' | 'EXT' | 'INT/EXT' | null
  locationText: string | null
  dayNight: string | null
  characters: string[]
  fullText: string
  stableKey: string
}

export interface ParseResult {
  scenes: ParsedScene[]
  warnings: string[]
}

// Без \b: Cyrillic-буквы не входят в стандартный \w, поэтому \b на границе
// «ИНТ.»/«НАТ.» не срабатывает. Вместо этого явно требуем, чтобы дальше шёл
// не-буквенный разделитель или конец строки.
const MARKER_RE =
  /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\/EXT|EXT\/INT|INT\.?|EXT\.?|EST\.?|ИНТ\.?\/НАТ\.?|НАТ\.?\/ИНТ\.?|ИНТ\/НАТ|НАТ\/ИНТ|ИНТ\.?|НАТ\.?)(?=[.\s\-–—:]|$)[.\s]*/iu

const LEADING_NUMBER_RE = /^(\d+[A-Za-zА-Яа-я]{0,2})[.)]\s+/
const TRAILING_NUMBER_RE = /#([^\s#]+)#\s*$/
const EPISODE_RE = /^\s*(серия|эпизод|episode)\s*[№#]?\s*(\d+)/i
const SEPARATOR_RE = /\s+[-–—]\s+/

function normalizeMarker(raw: string): ParsedScene['intExt'] {
  const m = raw.toUpperCase().replace(/\./g, '')
  if (m.includes('/')) return 'INT/EXT'
  if (m.startsWith('INT') || m.startsWith('ИНТ')) return 'INT'
  if (m.startsWith('EXT') || m.startsWith('НАТ') || m.startsWith('EST')) return 'EXT'
  return null
}

interface HeadingMatch {
  leadingNumber: string | null
  trailingNumber: string | null
  intExt: ParsedScene['intExt']
  rest: string
}

function matchHeading(line: string): HeadingMatch | null {
  let working = line.trim()
  const trailingMatch = working.match(TRAILING_NUMBER_RE)
  const trailingNumber = trailingMatch ? trailingMatch[1] : null
  if (trailingMatch) working = working.slice(0, trailingMatch.index).trim()

  const leadingMatch = working.match(LEADING_NUMBER_RE)
  const leadingNumber = leadingMatch ? leadingMatch[1] : null
  if (leadingMatch) working = working.slice(leadingMatch[0].length)

  const markerMatch = working.match(MARKER_RE)
  if (!markerMatch) return null

  const intExt = normalizeMarker(markerMatch[1])
  const rest = working.slice(markerMatch[0].length).replace(/^[.\-–—:\s]+/, '').trim()

  return { leadingNumber, trailingNumber, intExt, rest }
}

function splitLocationAndTime(rest: string): { locationText: string | null; dayNight: string | null } {
  if (!rest) return { locationText: null, dayNight: null }
  const parts = rest.split(SEPARATOR_RE)
  if (parts.length === 1) return { locationText: rest.trim() || null, dayNight: null }
  const dayNight = parts[parts.length - 1].trim()
  const locationText = parts.slice(0, -1).join(' - ').trim()
  return { locationText: locationText || null, dayNight: dayNight || null }
}

function looksLikeUnrecognizedHeading(line: string, prev: string, next: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 8 || trimmed.length > 70) return false
  if (!/\s/.test(trimmed)) return false
  const lettersOnly = trimmed.replace(/[^\p{L}]/gu, '')
  if (lettersOnly.length === 0) return false
  if (lettersOnly !== lettersOnly.toUpperCase()) return false
  if (prev.trim() !== '') return false
  // похоже на реплику персонажа, если сразу за ней идёт обычный (не капс) текст
  if (next.trim() !== '' && next.trim() !== next.trim().toUpperCase()) return false
  return true
}

function extractCharacterCues(bodyLines: string[]): string[] {
  const names = new Set<string>()
  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i].trim()
    if (!line) continue
    if (line.length > 40) continue
    const lettersOnly = line.replace(/[^\p{L}]/gu, '')
    if (lettersOnly.length < 2) continue
    if (lettersOnly !== lettersOnly.toUpperCase()) continue
    const prevBlank = i === 0 || bodyLines[i - 1].trim() === ''
    const nextLine = bodyLines[i + 1]?.trim() ?? ''
    const nextIsDialogue = nextLine !== '' && nextLine !== nextLine.toUpperCase()
    if (prevBlank && nextIsDialogue) {
      names.add(line.replace(/\s*\([^)]*\)\s*$/, '').trim())
    }
  }
  return [...names]
}

export function normalizeStableKey(episode: string | null, sceneNumber: string): string {
  return `${(episode ?? '').trim().toUpperCase()}|${sceneNumber.trim().toUpperCase()}`
}

export function parseScript(text: string): ParseResult {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const scenes: ParsedScene[] = []
  const warnings: string[] = []

  let currentEpisode: string | null = null
  let current: {
    episode: string | null
    leadingNumber: string | null
    trailingNumber: string | null
    intExt: ParsedScene['intExt']
    rest: string
    body: string[]
  } | null = null
  let autoIndex = 0

  const flush = () => {
    if (!current) return
    const { locationText, dayNight } = splitLocationAndTime(current.rest)
    const explicitNumber = current.leadingNumber ?? current.trailingNumber
    autoIndex += 1
    const sceneNumber = explicitNumber ?? `A${autoIndex}`
    const fullText = current.body.join('\n').trim()
    scenes.push({
      episode: current.episode,
      sceneNumber,
      numberInferred: !explicitNumber,
      intExt: current.intExt,
      locationText,
      dayNight,
      characters: extractCharacterCues(current.body),
      fullText,
      stableKey: normalizeStableKey(current.episode, sceneNumber),
    })
    current = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const episodeMatch = line.match(EPISODE_RE)
    if (episodeMatch) {
      flush()
      currentEpisode = episodeMatch[2]
      continue
    }

    const heading = matchHeading(line)
    if (heading) {
      flush()
      current = {
        episode: currentEpisode,
        leadingNumber: heading.leadingNumber,
        trailingNumber: heading.trailingNumber,
        intExt: heading.intExt,
        rest: heading.rest,
        body: [line],
      }
      continue
    }

    if (current) {
      current.body.push(line)
    }

    if (looksLikeUnrecognizedHeading(line, lines[i - 1] ?? '', lines[i + 1] ?? '')) {
      warnings.push(`Похоже на заголовок сцены, но не распознано (строка ${i + 1}): «${line.trim()}»`)
    }
  }
  flush()

  const seenKeys = new Map<string, number>()
  for (const scene of scenes) {
    seenKeys.set(scene.stableKey, (seenKeys.get(scene.stableKey) ?? 0) + 1)
  }
  for (const [key, count] of seenKeys) {
    if (count > 1) {
      warnings.push(`Дубликат номера сцены внутри импортируемого файла: ${key.split('|')[1]} (встречается ${count} раз)`)
    }
  }

  return { scenes, warnings }
}

export interface ExistingSceneRef {
  id: string
  stableKey: string
}

export interface ImportPlan {
  toCreate: ParsedScene[]
  toUpdate: { existingId: string; parsed: ParsedScene }[]
  duplicateStableKeys: string[]
}

/**
 * Строит план импорта: что создать, а что обновить по стабильному ключу
 * (серия+номер сцены), чтобы повторный импорт не плодил дубликаты.
 */
export function planImport(existing: ExistingSceneRef[], parsed: ParsedScene[]): ImportPlan {
  const existingByKey = new Map(existing.map((s) => [s.stableKey, s.id]))
  const toCreate: ParsedScene[] = []
  const toUpdate: { existingId: string; parsed: ParsedScene }[] = []
  const seenInImport = new Set<string>()
  const duplicateStableKeys: string[] = []

  for (const scene of parsed) {
    if (seenInImport.has(scene.stableKey)) {
      duplicateStableKeys.push(scene.stableKey)
      continue
    }
    seenInImport.add(scene.stableKey)

    const existingId = existingByKey.get(scene.stableKey)
    if (existingId) {
      toUpdate.push({ existingId, parsed: scene })
    } else {
      toCreate.push(scene)
    }
  }

  return { toCreate, toUpdate, duplicateStableKeys }
}

export async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}
