<template>
  <div class="chat-window">
    <!-- Header -->
    <div class="chat-header">
      <div class="chat-header__info">
        <h3 class="chat-header__name">{{ roomName }}</h3>
        <span v-if="typingText" class="chat-header__typing">{{ typingText }}</span>
        <span v-else-if="connected" class="chat-header__status chat-header__status--online">Connected</span>
        <span v-else class="chat-header__status chat-header__status--offline">Reconnecting…</span>
      </div>
    </div>

    <!-- Messages -->
    <div ref="messageList" class="chat-messages">
      <div
        v-for="msg in messages"
        :key="msg.chat_id ?? msg.tempId"
        class="chat-message"
        :class="{
          'chat-message--mine':    msg.sended_by === currentUserId,
          'chat-message--pending': msg.pending,
        }"
      >
        <!-- File message -->
        <template v-if="msg.msg_type === 3 || msg.msg_type === 2">
          <a v-if="msg.file_name" :href="msg.file_name" target="_blank" class="chat-message__file">
            📎 {{ msg.file_name }}
          </a>
        </template>
        <!-- Text message -->
        <template v-else>
          <p class="chat-message__text">{{ msg.message }}</p>
        </template>
        <span class="chat-message__time">{{ formatTime(msg.timestamp) }}</span>
        <span v-if="msg.pending" class="chat-message__pending-icon" title="Sending…">⏳</span>
      </div>
    </div>

    <!-- Input -->
    <form class="chat-input" @submit.prevent="submit">
      <input
        ref="inputEl"
        v-model="draft"
        type="text"
        class="chat-input__field"
        placeholder="Type a message…"
        autocomplete="off"
        @input="handleTyping"
      />
      <label class="chat-input__attach" title="Attach file">
        📎
        <input type="file" class="sr-only" @change="handleFileChange" />
      </label>
      <button type="submit" class="chat-input__send" :disabled="!draft.trim() && !pendingFile">
        Send
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '~/stores/chat'
import { useChatWs } from '~/composables/useChatWs'

definePageMeta({ middleware: 'auth', layout: 'chat' })

const route       = useRoute()
const chatStore   = useChatStore()
const { connected, sendMessage, sendTyping, markRead } = useChatWs()

const roomId      = computed(() => Number(route.params.roomId))
const messages    = computed(() => chatStore.messages[roomId.value] ?? [])
const room        = computed(() => chatStore.rooms[roomId.value])
const roomName    = computed(() => room.value?.name ?? `Room ${roomId.value}`)

// Assume current user id is stored in Pinia auth or nuxt-auth-utils session
const { session }    = useAuth()
const currentUserId  = computed(() => (session.value as any)?.id)

const recipients = computed(() => {
  const r = room.value
  if (!r) return []
  return [r.client_id, r.user_id, r.agency_id].filter(Boolean) as number[]
})

const typingText = computed(() => {
  const typers = chatStore.typingInActiveRoom.filter(t => t.userId !== currentUserId.value)
  if (!typers.length) return ''
  return typers.map(t => t.username).join(', ') + ' is typing…'
})

const draft      = ref('')
const pendingFile = ref<File | null>(null)
const messageList = ref<HTMLElement | null>(null)
const inputEl     = ref<HTMLInputElement | null>(null)

function formatTime(ts?: string) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function generateTempId() {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

async function submit() {
  if (!draft.value.trim() && !pendingFile.value) return

  if (pendingFile.value) {
    await uploadAndSend(pendingFile.value)
    pendingFile.value = null
    return
  }

  const text = draft.value.trim()
  draft.value = ''

  sendMessage({
    chat_room_id: roomId.value,
    sended_by:    currentUserId.value,
    message:      text,
    msg_type:     1,
    recipients:   recipients.value,
    tempId:       generateTempId(),
  })

  await nextTick()
  scrollToBottom()
  markRead(roomId.value, recipients.value)
}

async function uploadAndSend(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('chat_room_id', String(roomId.value))

  try {
    const res = await $fetch<{ name: string; base_urlWithpath: string; size: number }>(
      '/api/chat/upload',
      { method: 'POST', body: formData }
    )
    sendMessage({
      chat_room_id: roomId.value,
      sended_by:    currentUserId.value,
      msg_type:     file.type.startsWith('image/') ? 2 : 3,
      file_name:    res.name,
      file_type:    file.type,
      size:         String(res.size),
      recipients:   recipients.value,
      tempId:       generateTempId(),
    })
  } catch (err) {
    console.error('[Chat] upload failed:', err)
  }
}

function handleFileChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (file) pendingFile.value = file
}

function handleTyping() {
  if (!draft.value) return
  sendTyping(roomId.value, recipients.value, (session.value as any)?.first_name ?? 'User')
}

function scrollToBottom() {
  if (messageList.value) {
    messageList.value.scrollTop = messageList.value.scrollHeight
  }
}

watch(messages, async () => {
  await nextTick()
  scrollToBottom()
}, { deep: true })

onMounted(() => {
  chatStore.setActiveRoom(roomId.value)
  markRead(roomId.value, recipients.value)
  scrollToBottom()
  inputEl.value?.focus()
})
</script>

<style scoped>
.chat-window { display: flex; flex-direction: column; height: 100%; background: #fff; }

.chat-header { padding: .875rem 1.25rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: .75rem; background: #fff; flex-shrink: 0; }
.chat-header__name   { font-size: 1rem; font-weight: 600; color: #111827; margin: 0; }
.chat-header__typing { font-size: .8125rem; color: #6b7280; font-style: italic; }
.chat-header__status { font-size: .75rem; padding: 2px 8px; border-radius: 10px; }
.chat-header__status--online  { background: #dcfce7; color: #166534; }
.chat-header__status--offline { background: #fef3c7; color: #92400e; }

.chat-messages { flex: 1; overflow-y: auto; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: .5rem; }

.chat-message { max-width: 70%; display: flex; flex-direction: column; gap: 2px; }
.chat-message--mine { align-self: flex-end; align-items: flex-end; }
.chat-message:not(.chat-message--mine) { align-self: flex-start; }

.chat-message__text { background: #f3f4f6; color: #111827; padding: .5rem .875rem; border-radius: 18px; border-bottom-left-radius: 4px; margin: 0; font-size: .9375rem; line-height: 1.4; }
.chat-message--mine .chat-message__text { background: #f2613c; color: #fff; border-bottom-left-radius: 18px; border-bottom-right-radius: 4px; }

.chat-message__file { color: #f2613c; font-size: .875rem; text-decoration: underline; }
.chat-message__time  { font-size: .6875rem; color: #9ca3af; }
.chat-message--pending .chat-message__text { opacity: .6; }
.chat-message__pending-icon { font-size: .75rem; }

.chat-input { display: flex; align-items: center; gap: .5rem; padding: .75rem 1rem; border-top: 1px solid #e5e7eb; background: #fff; flex-shrink: 0; }
.chat-input__field { flex: 1; border: 1px solid #d1d5db; border-radius: 24px; padding: .5rem 1rem; font-size: .9375rem; outline: none; }
.chat-input__field:focus { border-color: #f2613c; }
.chat-input__attach { cursor: pointer; font-size: 1.25rem; color: #6b7280; user-select: none; }
.chat-input__send { background: #f2613c; color: #fff; border: none; border-radius: 24px; padding: .5rem 1.25rem; font-size: .9375rem; font-weight: 600; cursor: pointer; transition: background .15s; }
.chat-input__send:hover:not(:disabled) { background: #e05530; }
.chat-input__send:disabled { opacity: .5; cursor: default; }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
</style>
