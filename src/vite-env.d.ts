/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ACERVO_ENABLED?: string;
  readonly VITE_SUPPORT_URL?: string;
  readonly VITE_THEME_LAB?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
