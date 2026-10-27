import { type MigenvOptions, resolveOptions } from './options'
import { parseDirectives } from './directives'
import { commentedOutKey, entriesByKey, parse } from './parse'

/** How `current` differs from `template`, as returned by `diff`. */
export interface DiffReport {
  /** Current keys listed by `@retired` in the template. */
  readonly retired: readonly string[]
  /** Keys in the template that the current file lacks. */
  readonly missing: readonly string[]
  /** Keys in both whose current value is empty. */
  readonly empty: readonly string[]
  /** Keys in the current file that the template lacks, even as a commented-out `# KEY=`. */
  readonly extra: readonly string[]
  /** Whether the keys both files share appear in a different order. */
  readonly orderDiffers: boolean
}

/**
 * Compares `current` with `template` without changing anything. Uses the `duplicates` option to pick which of two same-named keys counts.
 * @example
 * diff('B=\nA=1\nOLD=x\n', 'A=\nB=\nC=\n')
 * // => { retired: [], missing: ['C'], empty: ['B'], extra: ['OLD'], orderDiffers: true }
 */
export function diff(current: string, template: string, options?: MigenvOptions): DiffReport {
  const { duplicates } = resolveOptions(options)
  const currentEntries = entriesByKey(parse(current), duplicates === 'first' ? 'first' : 'last')
  const templateDoc = parse(template)
  const templateKeys = [...entriesByKey(templateDoc, 'first').keys()]
  const optionalKeys = new Set(
    templateDoc.nodes.flatMap((node) => (node.kind === 'comment' ? [commentedOutKey(node)] : [])),
  )

  const currentKeys = [...currentEntries.keys()]
  const sharedInCurrentOrder = currentKeys.filter((key) => templateKeys.includes(key))
  const sharedInTemplateOrder = templateKeys.filter((key) => currentEntries.has(key))

  return {
    retired: parseDirectives(template).retired.filter((key) => currentEntries.has(key)),
    missing: templateKeys.filter((key) => !currentEntries.has(key)),
    empty: sharedInTemplateOrder.filter((key) => currentEntries.get(key)?.isEmpty === true),
    extra: currentKeys.filter((key) => !templateKeys.includes(key) && !optionalKeys.has(key)),
    orderDiffers: sharedInCurrentOrder.some((key, i) => key !== sharedInTemplateOrder[i]),
  }
}
