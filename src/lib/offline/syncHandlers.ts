import type { OutboxHandlers } from './outbox'
import { sendMessage } from '../../api/chat'
import { postBoardEvent } from '../../api/board'
import { setMyShiftStatus, type MemberStatus } from '../../api/shifts'

export const outboxHandlers: OutboxHandlers = {
  send_message: async (payload, opId) => {
    await sendMessage({
      channelId: payload.channelId as string,
      authorId: payload.authorId as string,
      text: payload.text as string,
      replyToId: (payload.replyToId as string | null) ?? null,
      clientOpId: opId,
    })
  },
  post_board_event: async (payload, opId) => {
    await postBoardEvent({
      projectId: payload.projectId as string,
      shiftId: payload.shiftId as string,
      type: payload.type as 'note' | 'change' | 'lunch' | 'weather',
      text: payload.text as string,
      authorId: payload.authorId as string,
      clientOpId: opId,
    })
  },
  set_my_status: async (payload) => {
    await setMyShiftStatus(payload.shiftId as string, payload.status as MemberStatus)
  },
}
