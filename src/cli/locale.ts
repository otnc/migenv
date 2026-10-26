export type Locale = 'en' | 'ja'

/**
 * Picks the output language from `--lang`, then `LC_ALL`, `LC_MESSAGES` and `LANG`, then the system locale.
 * Anything that does not start with `ja` falls back to English.
 */
export function detectLocale(
  lang: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
): Locale {
  // An empty variable counts as unset, as POSIX locale lookup does.
  const source =
    lang ||
    env.LC_ALL ||
    env.LC_MESSAGES ||
    env.LANG ||
    Intl.DateTimeFormat().resolvedOptions().locale
  return source.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}
