// stores/chat.ts
import { defineStore } from 'pinia'

export interface ChatMessage {
  chat_id?:      number
  tempId?:       string
  chat_room_id:  number
  sended_by:     number
  message:       string | null
  msg_type:      1 | 2 | 3
  file_name?:    string
  file_type?:    string
  timestamp:     string
  pending?:      boolean
}

interface TypingState {
  userId:    number
  username:  string
  expiresAt: number
}

export interface ChatRoom {
  chat_room_id: number
  job_id?:      number
  client_id:    number
  user_id:      number
  agency_id?:   number
  unreadCount:  number
  lastMessage?: ChatMessage
  isArchived:   boolean
  isMuted:      boolean
  isBlocked:    boolean
  name?:        string
  avatar?:      string
  onlineStatus?: boolean
}

interface ChatState {
  rooms:           Record<number, ChatRoom>
  messages:        Record<number, ChatMessage[]>
  activeRoomId:    number | null
  typing:          Record<number, TypingState[]>
  connected:       boolean
  pendingMessages: Record<string, ChatMessage>
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    rooms:           {},
    messages:        {},
    activeRoomId:    null,
    typing:          {},
    connected:       false,
    pendingMessages: {},
  }),

  getters: {
    activeRoom:    (s) => s.activeRoomId ? s.rooms[s.activeRoomId] : null,
    activeMessages:(s) => s.activeRoomId ? (s.messages[s.activeRoomId] ?? []) : [],
    sortedRooms:   (s) => Object.values(s.rooms).sort((a, b) => {
      const ta = new Date(a.lastMessage?.timestamp ?? 0).getTime()
      const tb = new Date(b.lastMessage?.timestamp ?? 0).getTime()
      return tb - ta
    }),
    totalUnread:   (s) => Object.values(s.rooms).reduce((sum, r) => sum + r.unreadCount, 0),
    typingInActiveRoom: (s): TypingState[] => {
      if (!s.activeRoomId) return []
      const now = Date.now()
      return (s.typing[s.activeRoomId] ?? []).filter(t => t.expiresAt > now)
    },
  },

  actions: {
    setConnected(val: boolean) {
      this.connected = val
    },

    setRooms(rooms: ChatRoom[]) {
      this.rooms = Object.fromEntries(rooms.map(r => [r.chat_room_id, r]))
    },

    setActiveRoom(chatRoomId: number) {
      this.activeRoomId = chatRoomId
    },

    setMessages(chatRoomId: number, messages: ChatMessage[]) {
      this.messages[chatRoomId] = messages
    },

    addPendingMessage(msg: ChatMessage) {
      if (!this.messages[msg.chat_room_id]) this.messages[msg.chat_room_id] = []
      this.messages[msg.chat_room_id].push({ ...msg, pending: true })
      if (msg.tempId) this.pendingMessages[msg.tempId] = msg
    },

    receiveMessage(msg: ChatMessage & { type?: string }) {
      const roomId = msg.chat_room_id
      if (!this.messages[roomId]) this.messages[roomId] = []

      if (msg.tempId && this.pendingMessages[msg.tempId]) {
        const idx = this.messages[roomId].findIndex(m => m.tempId === msg.tempId)
        if (idx >= 0) {
          this.messages[roomId][idx] = { ...msg, pending: false }
        }
        delete this.pendingMessages[msg.tempId]
      } else {
        this.messages[roomId].push(msg)
      }

      if (this.rooms[roomId]) {
        this.rooms[roomId].lastMessage = msg
        if (this.activeRoomId !== roomId) {
          this.rooms[roomId].unreadCount++
        }
      }
    },

    confirmMessageAck(_tempId: string) {
      // server ack received — Consumer1 will confirm via message_persisted
    },

    markRoomRead(chatRoomId: number, _readerUserId: number) {
      if (this.rooms[chatRoomId]) {
        this.rooms[chatRoomId].unreadCount = 0
      }
    },

    setTyping(chatRoomId: number, userId: number, username: string) {
      if (!this.typing[chatRoomId]) this.typing[chatRoomId] = []
      this.typing[chatRoomId] = this.typing[chatRoomId].filter(t => t.userId !== userId)
      this.typing[chatRoomId].push({ userId, username, expiresAt: Date.now() + 3000 })
    },

    handleInvitationAccepted(_result: any) {},

    setRoomArchived(chatRoomId: number, val: boolean) {
      if (this.rooms[chatRoomId]) this.rooms[chatRoomId].isArchived = val
    },
    setRoomMuted(chatRoomId: number, val: boolean) {
      if (this.rooms[chatRoomId]) this.rooms[chatRoomId].isMuted = val
    },
    setRoomBlocked(chatRoomId: number, val: boolean) {
      if (this.rooms[chatRoomId]) this.rooms[chatRoomId].isBlocked = val
    },
  },
})
