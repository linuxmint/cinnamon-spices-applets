/**
 * Typing for workspace root's `.env`.
 *
 * Doc: https://vite.dev/guide/env-and-mode.html#intellisense-for-typescript
 */

interface ViteTypeOptions {} // Makes the type of ImportMetaEnv strict to disallow unknown keys.

interface ImportMetaEnv {
    readonly VITE_KEEP_MAIN_FUNCTION_SENTINEL: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
