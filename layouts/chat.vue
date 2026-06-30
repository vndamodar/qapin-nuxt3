<template>
  <div class="chat-layout">
    <aside class="chat-sidebar" :class="{ 'chat-sidebar--collapsed': !sidebarOpen }">
      <div class="chat-sidebar__header">
        <h2 class="chat-sidebar__title">Messages</h2>
        <button class="chat-sidebar__collapse" @click="sidebarOpen = !sidebarOpen" aria-label="Toggle sidebar">
          &#9776;
        </button>
      </div>
      <div class="chat-sidebar__search">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search conversations…"
          class="chat-sidebar__search-input"
        />
      </div>
      <ul class="chat-room-list" role="list">
        <li
          v-for="room in filteredRooms"
          :key="room.chat_room_id"
          class="chat-room-item"
          :class="{ 'chat-room-item--active': room.chat_room_id === chatStore.activeRoomId }"
          role="button"
          :tabindex="0"
          @click="selectRoom(room.chat_room_id)"
          @keydown.enter="selectRoom(room.chat_room_id)"
        >
          <div class="chat-room-item__avatar">
            <img v-if="room.avatar" :src="room.avatar" :alt="room.name" class="chat-room-item__img" />
            <span v-else class="chat-room-item__initials">{{ initials(room.name) }}</span>
            <span v-if="room.onlineStatus" class="chat-room-item__online-dot" aria-label="Online"></span>
          </div>
          <div class="chat-room-item__info">
            <div class="chat-room-item__name-row">
              <span class="chat-room-item__name">{{ room.name }}</span>
              <span class="chat-room-item__time">{{ formatTime(room.lastMessage?.timestamp) }}</span>
            </div>
            <div class="chat-room-item__preview-row">
              <span class="chat-room-item__preview">{{ lastMessagePreview(room.lastMessage) }}</span>
              <span v-if="room.unreadCount > 0" class="chat-room-item__badge">{{ room.unreadCount }}</span>
            </div>
          </div>
        </li>
      </ul>
    </aside>

    <main class="chat-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatStore } from '~/stores/chat'
import { useRouter } from 'vue-router'

const chatStore = useChatStore()
const router    = useRouter()

const sidebarOpen = ref(true)
const searchQuery = ref('')

const filteredRooms = computed(() =>
  chatStore.sortedRooms.filter(r =>
    !searchQuery.value || r.name?.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)

function selectRoom(chatRoomId: number) {
  chatStore.setActiveRoom(chatRoomId)
  router.push(`/chat/${chatRoomId}`)
}

function initials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function formatTime(ts?: string) {
  if (!ts) return ''
  const d   = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function lastMessagePreview(msg?: any) {
  if (!msg) return ''
  if (msg.msg_type === 2) return '📷 Image'
  if (msg.msg_type === 3) return `📎 ${msg.file_name || 'File'}`
  return msg.message?.slice(0, 50) ?? ''
}
</script>

<style scoped>
.chat-layout { display: flex; height: 100vh; overflow: hidden; background: #f7f8fa; }

.chat-sidebar { width: 320px; min-width: 320px; background: #fff; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; transition: width .2s ease, min-width .2s ease; overflow: hidden; }
.chat-sidebar--collapsed { width: 64px; min-width: 64px; }

.chat-sidebar__header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1rem .75rem; border-bottom: 1px solid #f0f0f0; }
.chat-sidebar__title  { font-size: 1.125rem; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; }
.chat-sidebar__collapse { background: none; border: none; cursor: pointer; padding: .25rem; color: #6b7280; flex-shrink: 0; }

.chat-sidebar__search { padding: .75rem 1rem; border-bottom: 1px solid #f0f0f0; }
.chat-sidebar__search-input { width: 100%; padding: .5rem .75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: .875rem; outline: none; box-sizing: border-box; }
.chat-sidebar__search-input:focus { border-color: #f2613c; box-shadow: 0 0 0 2px rgba(242,97,60,.15); }

.chat-room-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.chat-room-item { display: flex; align-items: center; gap: .75rem; padding: .875rem 1rem; cursor: pointer; border-bottom: 1px solid #f9fafb; transition: background .1s; }
.chat-room-item:hover, .chat-room-item:focus-visible { background: #f9fafb; outline: none; }
.chat-room-item--active { background: #fff4f1; }

.chat-room-item__avatar { position: relative; flex-shrink: 0; }
.chat-room-item__img { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; }
.chat-room-item__initials { width: 42px; height: 42px; border-radius: 50%; background: #f2613c; color: #fff; font-size: .875rem; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.chat-room-item__online-dot { position: absolute; bottom: 2px; right: 2px; width: 10px; height: 10px; border-radius: 50%; background: #22c55e; border: 2px solid #fff; }

.chat-room-item__info { flex: 1; min-width: 0; }
.chat-room-item__name-row { display: flex; justify-content: space-between; align-items: baseline; gap: .5rem; }
.chat-room-item__name { font-size: .9rem; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chat-room-item__time { font-size: .75rem; color: #9ca3af; white-space: nowrap; flex-shrink: 0; }
.chat-room-item__preview-row { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
.chat-room-item__preview { font-size: .8125rem; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chat-room-item__badge { background: #f2613c; color: #fff; font-size: .7rem; font-weight: 700; border-radius: 10px; padding: 1px 6px; min-width: 18px; text-align: center; flex-shrink: 0; }

.chat-main { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
</style>
