import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useProjectContext } from '../../context/ProjectContext'
import { useAuth } from '../../state/auth'
import { setMemberRole, removeMember, roleAtLeast, type ProjectMember } from '../../api/projects'
import { listInvites, createInvite, revokeInvite, type Invite } from '../../api/invites'

const ROLE_LABELS: Record<ProjectMember['role'], string> = {
  owner: 'Владелец',
  coordinator: 'Координатор',
  member: 'Участник',
}

export default function MembersPage() {
  const { project, members, myRole } = useProjectContext()
  const user = useAuth((s) => s.user)
  const isOwner = roleAtLeast(myRole, 'owner')
  const qc = useQueryClient()
  const [inviteRole, setInviteRole] = useState<Invite['role']>('member')

  const invitesQuery = useQuery({ queryKey: ['invites', project.id], queryFn: () => listInvites(project.id), enabled: isOwner })

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: ProjectMember['role'] }) => setMemberRole(project.id, input.userId, input.role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-members', project.id] }),
  })
  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(project.id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-members', project.id] }),
  })
  const createInviteMutation = useMutation({
    mutationFn: () => createInvite({ projectId: project.id, role: inviteRole, ttlHours: 72, maxUses: 0 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites', project.id] }),
  })
  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites', project.id] }),
  })

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <h1 className="text-xl font-semibold">Участники</h1>

      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-3 text-sm">
            <div>
              <div className="font-medium">{m.display_name}</div>
              <div className="text-xs text-[var(--color-text-faint)]">{ROLE_LABELS[m.role]}</div>
            </div>
            {isOwner && m.user_id !== user?.id && (
              <div className="flex items-center gap-2">
                <select
                  value={m.role}
                  onChange={(e) => roleMutation.mutate({ userId: m.user_id, role: e.target.value as ProjectMember['role'] })}
                  className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-2 py-1 text-xs"
                >
                  {(Object.keys(ROLE_LABELS) as ProjectMember['role'][]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (confirm(`Убрать ${m.display_name} из проекта?`)) removeMutation.mutate(m.user_id)
                  }}
                  className="tap-target rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-danger)]"
                >
                  Убрать
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4">
          <h2 className="mb-2 font-medium">Приглашения</h2>
          <div className="mb-3 flex gap-2">
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Invite['role'])} className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-2 py-1.5 text-sm">
              <option value="member">Участник</option>
              <option value="coordinator">Координатор</option>
            </select>
            <button
              onClick={() => createInviteMutation.mutate()}
              disabled={createInviteMutation.isPending}
              className="tap-target rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-text)] disabled:opacity-60"
            >
              Создать код (72 ч)
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {(invitesQuery.data ?? []).map((inv) => {
              const expired = new Date(inv.expires_at) <= new Date()
              const revoked = !!inv.revoked_at
              return (
                <li key={inv.id} className="flex items-center justify-between rounded-lg bg-[var(--color-bg-sunken)] px-3 py-2 text-sm">
                  <div>
                    <div className="font-mono tracking-widest">{inv.code}</div>
                    <div className="text-xs text-[var(--color-text-faint)]">
                      {ROLE_LABELS[inv.role]} · {revoked ? 'отозван' : expired ? 'истёк' : `до ${new Date(inv.expires_at).toLocaleString('ru-RU')}`} · использован {inv.uses_count} раз
                    </div>
                  </div>
                  {!revoked && !expired && (
                    <button onClick={() => revokeMutation.mutate(inv.id)} className="tap-target rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-danger)]">
                      Отозвать
                    </button>
                  )}
                </li>
              )
            })}
            {(invitesQuery.data ?? []).length === 0 && <p className="text-sm text-[var(--color-text-faint)]">Приглашений пока нет.</p>}
          </ul>
        </div>
      )}
    </div>
  )
}
