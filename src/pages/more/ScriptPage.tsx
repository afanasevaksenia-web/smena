import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useProjectContext } from '../../context/ProjectContext'
import { roleAtLeast } from '../../api/projects'
import { listScenes, createScenesFromImport, updateScenesFromImport, markSceneShot, deleteScene, assignSceneToShift } from '../../api/scenes'
import { ensureSceneChannel } from '../../api/chat'
import { parseScript, planImport, extractDocxText, type ParseResult, type ImportPlan } from '../../lib/scriptParser'

export default function ScriptPage() {
  const { project, myRole, viewingShift } = useProjectContext()
  const canEdit = roleAtLeast(myRole, 'coordinator')
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [importing, setImporting] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const scenesQuery = useQuery({ queryKey: ['scenes', project.id], queryFn: () => listScenes(project.id) })

  async function handleFile(file: File) {
    setFileError(null)
    if (file.size > 15 * 1024 * 1024) {
      setFileError('Файл слишком большой (максимум 15 МБ).')
      return
    }
    try {
      let text: string
      if (file.name.toLowerCase().endsWith('.docx')) {
        text = await extractDocxText(file)
      } else {
        text = await file.text()
      }
      const result = parseScript(text)
      setParseResult(result)
      const existing = (scenesQuery.data ?? []).map((s) => ({ id: s.id, stableKey: s.stable_key }))
      setPlan(planImport(existing, result.scenes))
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Не удалось прочитать файл')
    }
  }

  async function confirmImport() {
    if (!plan) return
    setImporting(true)
    try {
      await createScenesFromImport(project.id, plan.toCreate)
      await updateScenesFromImport(plan.toUpdate)
      qc.invalidateQueries({ queryKey: ['scenes', project.id] })
      setParseResult(null)
      setPlan(null)
    } finally {
      setImporting(false)
    }
  }

  const shotMutation = useMutation({
    mutationFn: (input: { id: string; shot: boolean }) => markSceneShot(input.id, input.shot),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenes', project.id] }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteScene(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenes', project.id] }),
  })
  const assignMutation = useMutation({
    mutationFn: (sceneId: string) => assignSceneToShift(sceneId, viewingShift!.id, null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenes', project.id] }),
  })
  const openDiscussion = async (sceneId: string, label: string) => {
    const channel = await ensureSceneChannel(project.id, sceneId, `Сцена ${label}`)
    navigate(`../chats/${channel.id}`)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (scenesQuery.data ?? []).filter((s) => {
      if (!q) return true
      return (
        s.scene_number.toLowerCase().includes(q) ||
        (s.episode ?? '').toLowerCase().includes(q) ||
        (s.location_text ?? '').toLowerCase().includes(q) ||
        (s.full_text ?? '').toLowerCase().includes(q) ||
        s.characters.some((c) => c.toLowerCase().includes(q))
      )
    })
  }, [scenesQuery.data, search])

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <h1 className="text-xl font-semibold">Сценарий</h1>

      {canEdit && (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4">
          <label className="tap-target flex cursor-pointer flex-col items-center gap-2 text-center text-sm text-[var(--color-text-dim)]">
            <span>Импортировать TXT, Fountain или DOCX</span>
            <input
              type="file"
              accept=".txt,.fountain,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
            <span className="rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-[var(--color-accent-text)]">Выбрать файл</span>
          </label>
          {fileError && <p className="mt-2 text-center text-sm text-[var(--color-danger)]">{fileError}</p>}
        </div>
      )}

      {parseResult && plan && (
        <div className="rounded-xl border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-4">
          <h2 className="mb-2 font-medium">Предпросмотр импорта</h2>
          <ul className="mb-3 text-sm text-[var(--color-text-dim)]">
            <li>Найдено сцен: {parseResult.scenes.length}</li>
            <li>Новых: {plan.toCreate.length}</li>
            <li>Будет обновлено существующих: {plan.toUpdate.length}</li>
            {plan.duplicateStableKeys.length > 0 && <li className="text-[var(--color-warn)]">Дубликаты в файле пропущены: {plan.duplicateStableKeys.length}</li>}
          </ul>
          {parseResult.warnings.length > 0 && (
            <div className="mb-3 rounded-lg bg-[var(--color-warn)]/10 p-2 text-xs text-[var(--color-warn)]">
              {parseResult.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={confirmImport}
              disabled={importing}
              className="tap-target rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-text)] disabled:opacity-60"
            >
              {importing ? 'Импортируем…' : 'Подтвердить импорт'}
            </button>
            <button
              onClick={() => {
                setParseResult(null)
                setPlan(null)
              }}
              className="tap-target rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по номеру, серии, локации, персонажу, тексту"
        className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      />

      <ul className="flex flex-col gap-2">
        {filtered.map((s) => (
          <li key={s.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">
                  {s.episode ? `Серия ${s.episode} · ` : ''}
                  Сцена {s.scene_number} {s.int_ext ? `— ${s.int_ext}` : ''}
                </div>
                <div className="truncate text-[var(--color-text-dim)]">
                  {s.location_text} {s.day_night ? `· ${s.day_night}` : ''}
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => openDiscussion(s.id, s.scene_number)} className="tap-target rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-accent)]">
                Обсуждение
              </button>
              {canEdit && (
                <>
                  {viewingShift && s.shift_id !== viewingShift.id && (
                    <button onClick={() => assignMutation.mutate(s.id)} className="tap-target rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-dim)]">
                      На текущую смену
                    </button>
                  )}
                  <button
                    onClick={() => shotMutation.mutate({ id: s.id, shot: !s.shot })}
                    className={`tap-target rounded-lg px-2 py-1 text-xs ${s.shot ? 'bg-[var(--color-ok)]/15 text-[var(--color-ok)]' : 'border border-[var(--color-border)] text-[var(--color-text-dim)]'}`}
                  >
                    {s.shot ? 'Снято ✓' : 'Отметить снято'}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Удалить сцену ${s.scene_number}?`)) deleteMutation.mutate(s.id)
                    }}
                    className="tap-target rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-danger)]"
                  >
                    Удалить
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
        {filtered.length === 0 && <p className="text-sm text-[var(--color-text-faint)]">Сцены не найдены.</p>}
      </ul>
    </div>
  )
}
