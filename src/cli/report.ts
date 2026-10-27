import { colors } from 'consola/utils'
import type { AlignResult, Warning } from '../core/index'
import type { Translate } from './i18n'

/** One line per key that changed, followed by a note when only the order or comments did. Never includes values. */
export function changeLines(result: AlignResult, t: Translate): string[] {
  const lines = [
    ...result.renamed.map(
      ({ from, to }) =>
        `  ${colors.cyan('~')} ${from} → ${to}   ${colors.dim(`(${t('report.renamed')})`)}`,
    ),
    ...result.added.map(
      (key) => `  ${colors.green('+')} ${key}   ${colors.dim(`(${t('report.added')})`)}`,
    ),
    ...result.removed.map(
      (key) => `  ${colors.red('-')} ${key}   ${colors.dim(`(${t('report.removed')})`)}`,
    ),
    ...result.extra.map(
      (key) => `  ${colors.yellow('?')} ${key}   ${colors.dim(`(${t('report.extra')})`)}`,
    ),
    ...result.protectedSkips.map(
      ({ key, action }) =>
        `  ${colors.magenta('!')} ${key}   ${colors.dim(
          `(${t(action === 'default' ? 'report.protectedDefault' : action === 'rename' ? 'report.protectedRename' : 'report.protectedRemove')})`,
        )}`,
    ),
  ]
  const onlyLayout =
    result.changed &&
    result.added.length === 0 &&
    result.removed.length === 0 &&
    result.renamed.length === 0
  if (onlyLayout) lines.push(`  ${colors.cyan('~')} ${colors.dim(t('report.reordered'))}`)
  return lines
}

/** Warnings other than `protected`, which `changeLines` already shows, in the user's language. */
export function warningMessages(
  warnings: readonly Warning[],
  { file, template }: { readonly file: string; readonly template: string },
  t: Translate,
): string[] {
  return warnings.flatMap((warning) => {
    const line = warning.line ?? 0
    switch (warning.code) {
      case 'invalid-directive':
        return [t('warning.invalidDirective', { file: template, line })]
      case 'rename-conflict':
        return [t('warning.renameConflict', { file, key: warning.key ?? '' })]
      case 'retired-key':
        return [t('warning.retiredKey', { file, key: warning.key ?? '' })]
      case 'unknown-line':
        return [
          warning.source === 'current'
            ? t('warning.unknownLine.current', { file, line })
            : t('warning.unknownLine.template', { file: template, line }),
        ]
      case 'duplicate-key':
        return [t('warning.duplicateKey', { file, key: warning.key ?? '', line })]
      case 'ambiguous-quote':
        return [t('warning.ambiguousQuote', { file })]
      case 'protected':
        return []
    }
  })
}
