import { type ProtectedSkip, type Warning } from './align'
import { MigenvError } from './errors'
import { type MigenvOptions, resolveOptions } from './options'
import { parse, stringify } from './parse'

/** The text and diagnostics returned by `prune`. */
export interface PruneResult {
  readonly text: string
  readonly changed: boolean
  readonly removed: readonly string[]
  readonly protectedSkips: readonly ProtectedSkip[]
  readonly warnings: readonly Warning[]
}

/**
 * Deletes every occurrence of the listed keys, except protected entries. Other bytes, including comments, unknown lines, BOM and line endings, are kept. `strict` rejects unknown lines before any changes.
 * @example
 * prune('OLD=x\nKEEP=y\n', ['OLD']).text // => 'KEEP=y\n'
 */
export const prune = (
  text: string,
  keys: readonly string[],
  options?: MigenvOptions,
): PruneResult => {
  const resolved = resolveOptions(options)
  const doc = parse(text)
  const removed = new Set<string>()
  const protectedSkips: ProtectedSkip[] = []
  const warnings: Warning[] = []
  const targets = new Set(keys)
  const nodes = doc.nodes.filter((node) => {
    if (node.kind === 'unknown') {
      if (resolved.strict)
        throw new MigenvError('UNKNOWN_LINE', `Line ${node.line} could not be parsed.`)
      warnings.push({
        code: 'unknown-line',
        source: 'current',
        line: node.line,
        message: `Line ${node.line} could not be parsed and was kept as is.`,
      })
    }
    if (node.kind !== 'entry' || !targets.has(node.key)) return true
    if (resolved.isProtected(node.key, node.rawValue)) {
      protectedSkips.push({ key: node.key, action: 'remove' })
      warnings.push({
        code: 'protected',
        source: 'current',
        key: node.key,
        message: `"${node.key}" is protected and was kept.`,
      })
      return true
    }
    removed.add(node.key)
    return false
  })
  const output = stringify({ ...doc, nodes })
  return { text: output, changed: output !== text, removed: [...removed], protectedSkips, warnings }
}
