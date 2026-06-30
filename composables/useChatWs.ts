// composables/useChatWs.ts
// Native browser WebSocket only — zero socket.io dependency.

import { ref, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '~/stores/chat'

type WsMessage = {
  type: string
  [key: string]: unknown
}

const RECONNECT_BASE_MS  = 1000
const RECONNECT_MAX_MS   = 30000
const HEARTBEAT_INTERVAL = 25000

export function useChatWs() {
  const chatStore = useChatStore()
  const config    = useRuntimeConfig()

  let ws:              WebSocket | null = null
  let reconnectAttempt = 0
  let reconnectTimer:  ReturnType<typeof setTimeout>  | null = null
  let heartbeatTimer:  ReturnType<typeof setInterval> | null = null

  const connected  = ref(false)
  const connecting = ref(false)

  function connect(token: string) {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

    connecting.value = true
    const url = `${config.public.wsUrl}?token=${encodeURIComponent(token)}`
    ws = new WebSocket(url)

    ws.onopen = () => {
      connected.value  = true
      connecting.value = false
      reconnectAttempt = 0
      startHeartbeat()
    }

    ws.onmessage = (ev) => {
      let msg: WsMessage
      try { msg = JSON.parse(ev.data) } catch { return }
      handleIncoming(msg)
    }

    ws.onclose = () => {
      connected.value  = false
      connecting.value = false
      stopHeartbeat()
      scheduleReconnect(token)
    }

    ws.onerror = (err) => {
      console.error('[WS] error', err)
    }
  }

  function scheduleReconnect(token: string) {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS)
    reconnectAttempt++
    reconnectTimer = setTimeout(() => connect(token), delay)
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    stopHeartbeat()
    ws?.close()
    ws = null
    connected.value = false
  }

  function startHeartbeat() {
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, HEARTBEAT_INTERVAL)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  }

  function send(payload: WsMessage) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS] not connected, dropping:', payload.type)
      return
    }
    ws.send(JSON.stringify(payload))
  }

  function sendMessage(params: {
    chat_room_id:        number
    sended_by:           number
    message?:            string
    msg_type?:           1 | 2 | 3
    file_name?:          string
    file_type?:          string
    size?:               string
    parent_id?:          number
    chat_invitation_id?: number
    recipients:          number[]
    tempId:              string
  }) {
    chatStore.addPendingMessage({
      chat_room_id: params.chat_room_id,
      sended_by:    params.sended_by,
      message:      params.message ?? null,
      msg_type:     params.msg_type ?? 1,
      timestamp:    new Date().toISOString(),
      tempId:       params.tempId,
    })
    send({ type: 'send_message', data: params })
  }

  let lastTyping = 0
  function sendTyping(chat_room_id: number, recipients: number[], username: string) {
    const now = Date.now()
    if (now - lastTyping < 2000) return
    lastTyping = now
    send({ type: 'typing', data: { chat_room_id, recipients, username } })
  }

  function markRead(chat_room_id: number, recipients: number[], chat_invitation_id?: number) {
    send({ type: 'read_messages', data: { chat_room_id, recipients, chat_invitation_id } })
  }

  function previewAttachment(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { resolve(''); return }
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function handleIncoming(msg: WsMessage) {
    switch (msg.type) {
      case 'connected':
        chatStore.setConnected(true)
        break
      case 'new_message':
      case 'message_persisted':
        chatStore.receiveMessage(msg as any)
        break
      case 'typing':
        chatStore.setTyping(
          msg.chat_room_id as number,
          msg.userId       as number,
          msg.username     as string,
        )
        break
      case 'messages_read':
        chatStore.markRoomRead(msg.chat_room_id as number, msg.readerUserId as number)
        break
      case 'message_ack':
        chatStore.confirmMessageAck(msg.tempId as string)
        break
      case 'invitation_accepted':
        chatStore.handleInvitationAccepted(msg.result as any)
        break
      case 'pong':
        break
      case 'error':
        console.error('[WS] server error:', msg.code, msg.message)
        break
    }
  }

  onUnmounted(() => disconnect())

  return {
    connected,
    connecting,
    connect,
    disconnect,
    sendMessage,
    sendTyping,
    markRead,
    previewAttachment,
  }
}
