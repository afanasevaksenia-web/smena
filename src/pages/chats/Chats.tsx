import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useProjectContext } from '../../context/ProjectContext'
import { useAuth } from '../../state/auth'
import { listChannels, listMessages, sendMessage, ensureDepartmentChannel, type Message } from '../../api/chat'
import { listContacts } from '../../api/contacts'
import { supabase } from '../../lib/supabase'
import { getDraft, setDraft } from '../../lib/offline/drafts'
import { enqueue, listOutbox, processOutbox } from '../../lib/offline/outbox'
import { outboxHandlers } from '../../lib/offline/syncHandlers'
import { markRead, countUnread } from '../../lib/lastRead'
import { formatInProjectTimeZone } from '../../lib/time'

export default function Chats() {
  const { project, viewingShift } = useProjectContext()
  const { channelId } = useParams<{ channelId: string }>()
  const navigate = useNavigate()

  const channelsQuery = useQuery({ queryKey: ['channels', project.id], queryFn: () => listChannels(project.id) })
  const contactsQuery = useQuery({ queryKey: ['contacts', project.id], queryFn: () => listContacts(project.id) })
  const qc = useQueryClient()

  const departments = useMemo(() => {
    const set = new Set<string>()
    for (const c of contactsQuery.data ?? []) if (c.department) set.add(c.department)
    return [...set].sort()
  }, [contactsQuery.data])

  const ensureDeptMutation = useMutation({
    mutationFn: (dept: string) => ensureDepartmentChannel(project.id, dept),
    onSuccess: (channel) => {
      qc.invalidateQueries({ queryKey: ['channels', project.id] })
      navigate(`../chats/${channel.id}`)
    },
  })

  const general = (channelsQuery.data ?? []).find((c) => c.type === 'general')
  const deptChannels = (channelsQuery.data ?? []).filter((c) => c.type === 'department')
  const sceneChannels = (channelsQuery.data ?? []).filter((c) => c.type === 'scene')

  const tz = viewingShift?.timezone ?? 'Europe/Moscow'

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className={`w-full shrink-0 border-[var(--color-border)] md:w-72 md:border-r ${channelId ? 'hidden md:block' : ''}`}>
        <div className="p-4">
          <h1 className="mb-3 text-lg font-semibold">Чаты</h1>
          <nav className="flex flex-col gap-1">
            {general && <ChannelLink id={general.id} label={general.name} active={channelId === general.id} />}
            {deptChannels.map((c) => (
              <ChannelLink key={c.id} id={c.id} label={c.name} active={channelId === c.id} />
            ))}
            {sceneChannels.map((c) => (
              <ChannelLink key={c.id} id={c.id} label={c.name} active={channelId === c.id} />
            ))}
          </nav>

          {departments.filter((d) => !deptChannels.some((c) => c.department === d)).length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs text-[var(--color-text-faint)]">Открыть чат цеха</div>
              <div className="flex flex-wrap gap-1.5">
                {departments
                  .filter((d) => !deptChannels.some((c) => c.department === d))
                  .map((d) => (
                    <button
                      key={d}
                      onClick={() => ensureDeptMutation.mutate(d)}
                      className="tap-target rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-dim)]"
                    >
                      {d}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      <section className={`flex min-w-0 flex-1 flex-col ${channelId ? '' : 'hidden md:flex'}`}>
        {channelId ? (
          <MessageThread key={channelId} channelId={channelId} projectId={project.id} timezone={tz} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-[var(--color-text-faint)]">Выберите чат</div>
        )}
      </section>
    </div>
  )
}

function ChannelLink({ id, label, active }: { id: string; label: string; active: boolean }) {
  return (
    <Link
      to={`../chats/${id}`}
      className={`tap-target rounded-lg px-3 py-2 text-sm ${active ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]' : 'text-[var(--color-text-dim)] hover:bg-[var(--color-bg-raised)]'}`}
    >
      {label}
    </Link>
  )
}

function MessageThread({ channelId, projectId, timezone }: { channelId: string; projectId: string; timezone: string }) {
  const user = useAuth((s) => s.user)
  const qc = useQueryClient()
  const listRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [search, setSearch] = useState('')
  const [showJumpToNew, setShowJumpToNew] = useState(false)

  const messagesQuery = useQuery({ queryKey: ['messages', channelId], queryFn: () => listMessages(channelId) })

  useEffect(() => {
    getDraft(projectId, channelId).then(setText)
  }, [projectId, channelId])

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` }, () => {
        qc.invalidateQueries({ queryKey: ['messages', channelId] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelId, qc])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) {
      el.scrollTop = el.scrollHeight
      markRead(channelId, new Date().toISOString())
      setShowJumpToNew(false)
    } else {
      setShowJumpToNew(true)
    }
    // сохранение прокрутки: не форсируем скролл вниз, если читают историю
  }, [messagesQuery.data, channelId])

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user || !text.trim()) return
      const clientOpId = crypto.randomUUID()
      const payload = { channelId, authorId: user.id, text: text.trim(), replyToId: replyTo?.id ?? null }
      try {
        await sendMessage({ ...payload, clientOpId })
      } catch (err) {
        // офлайн или сбой сети — не теряем сообщение, кладём в очередь на отправку
        await enqueue('send_message', payload, clientOpId)
        if (!navigator.onLine) return
        throw err
      }
    },
    onSuccess: () => {
      setText('')
      setDraft(projectId, channelId, '')
      setReplyTo(null)
      qc.invalidateQueries({ queryKey: ['messages', channelId] })
      qc.invalidateQueries({ queryKey: ['outbox', channelId] })
    },
  })

  const outboxQuery = useQuery({
    queryKey: ['outbox', channelId],
    queryFn: async () => {
      const all = await listOutbox()
      return all.filter((op) => op.kind === 'send_message' && op.payload.channelId === channelId)
    },
    refetchInterval: 4000,
  })

  function handleChangeText(v: string) {
    setText(v)
    setDraft(projectId, channelId, v)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      sendMutation.mutate()
    }
  }

  const filtered = (messagesQuery.data ?? []).filter((m) => (search.trim() ? m.text.toLowerCase().includes(search.trim().toLowerCase()) : true))
  const messagesById = useMemo(() => new Map((messagesQuery.data ?? []).map((m) => [m.id, m])), [messagesQuery.data])
  const unread = countUnread(channelId, messagesQuery.data ?? [], user?.id)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-3">
        <Link to="../chats" className="md:hidden text-[var(--color-accent)]">
          ←
        </Link>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск в чате"
          className="tap-target flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        {unread > 0 && <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-xs text-[var(--color-accent-text)]">{unread}</span>}
      </div>

      <div ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-2">
          {filtered.map((m) => (
            <li key={m.id} id={`msg-${m.id}`} className="max-w-[85%] rounded-xl bg-[var(--color-bg-raised)] px-3 py-2 text-sm">
              {m.reply_to_id && messagesById.get(m.reply_to_id) && (
                <button
                  onClick={() => document.getElementById(`msg-${m.reply_to_id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                  className="mb-1 block w-full truncate rounded-md border-l-2 border-[var(--color-accent)] bg-[var(--color-bg-sunken)] px-2 py-1 text-left text-xs text-[var(--color-text-faint)]"
                >
                  {messagesById.get(m.reply_to_id)?.text}
                </button>
              )}
              <div className="whitespace-pre-wrap break-words">{m.text}</div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-text-faint)]">
                <span>{formatInProjectTimeZone(m.created_at, timezone, 'HH:mm')}</span>
                <button onClick={() => setReplyTo(m)} className="underline-offset-2 hover:underline">
                  Ответить
                </button>
              </div>
            </li>
          ))}
          {(outboxQuery.data ?? []).map((op) => (
            <li key={op.id} className="max-w-[85%] rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 text-sm opacity-80">
              <div className="whitespace-pre-wrap break-words">{String(op.payload.text)}</div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-text-faint)]">
                {op.status === 'error' ? (
                  <>
                    <span className="text-[var(--color-danger)]">Ошибка отправки</span>
                    <button
                      className="underline-offset-2 hover:underline"
                      onClick={async () => {
                        await processOutbox(outboxHandlers)
                        qc.invalidateQueries({ queryKey: ['outbox', channelId] })
                        qc.invalidateQueries({ queryKey: ['messages', channelId] })
                      }}
                    >
                      Повторить
                    </button>
                  </>
                ) : (
                  <span>Ожидает отправки…</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showJumpToNew && (
        <button
          onClick={() => {
            listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
            setShowJumpToNew(false)
          }}
          className="tap-target absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-xs font-medium text-[var(--color-accent-text)] shadow-lg md:bottom-20"
        >
          Новые сообщения ↓
        </button>
      )}

      <div className="border-t border-[var(--color-border)] p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-[var(--color-bg-raised)] px-3 py-1.5 text-xs text-[var(--color-text-dim)]">
            <span className="truncate">Ответ на: {replyTo.text}</span>
            <button onClick={() => setReplyTo(null)} aria-label="Отменить ответ">
              ✕
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => handleChangeText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Сообщение… Enter — новая строка, Ctrl+Enter — отправить"
            className="tap-target flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="button"
            disabled={!text.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
            className="tap-target rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-accent-text)] disabled:opacity-50"
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  )
}
