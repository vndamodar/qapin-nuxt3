// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@pinia/nuxt',
    'nuxt-auth-utils',
  ],
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET_KEY,
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000/api',
      wsUrl:   process.env.NUXT_PUBLIC_WS_URL   || 'ws://localhost:3000',
    },
  },
  ssr: true,
})
