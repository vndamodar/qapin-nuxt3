// server/api/chat/upload.post.ts
// Validates and proxies file uploads to the existing backend upload endpoint.
import { defineEventHandler, readMultipartFormData, createError, getCookie } from 'h3'

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]
const MAX_BYTES = 25 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  if (!parts?.length) throw createError({ statusCode: 400, message: 'No file uploaded' })

  const filePart = parts.find(p => p.name === 'file')
  if (!filePart) throw createError({ statusCode: 400, message: 'file field required' })

  if (!ALLOWED_TYPES.includes(filePart.type ?? '')) {
    throw createError({ statusCode: 415, message: `File type not allowed: ${filePart.type}` })
  }
  if ((filePart.data?.length ?? 0) > MAX_BYTES) {
    throw createError({ statusCode: 413, message: 'File exceeds 25 MB limit' })
  }

  const config = useRuntimeConfig()
  const authCookie = getCookie(event, 'token')

  const formData = new FormData()
  formData.append('image', new Blob([filePart.data], { type: filePart.type }), filePart.filename)
  parts.filter(p => p.name !== 'file').forEach(p => {
    formData.append(p.name!, p.data.toString())
  })

  return $fetch(`${config.public.apiBase}/chat/upload-file`, {
    method: 'POST',
    body:   formData,
    headers: authCookie ? { Cookie: `token=${authCookie}` } : {},
  })
})
