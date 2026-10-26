import { createT } from '@kiritan/runtime'
import type { Locale } from './locale'
import messages from './messages.i18n'

export type MessageKey = keyof typeof messages
export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string

export function createTranslator(locale: Locale): Translate {
  const translator = createT(messages, { locale, fallbackLocale: 'en' })
  return (key, params) => translator.t(key, params)
}
