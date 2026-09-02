/// <reference types="vite/client" />

// Typed environment variables. Keeping this in sync with .env.example means
// a typo in an env var name is a compile error instead of a silent `undefined`.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
