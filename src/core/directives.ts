import type { Warning } from './align'
import { parse } from './parse'

/** A template's rename rules, retired keys and diagnostics. */
export interface DirectiveSet {
  readonly renamedFrom: ReadonlyMap<string, string>
  readonly retired: readonly string[]
  readonly warnings: readonly Warning[]
}

const KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/

/**
 * Reads `@renamed-from OLD` immediately above a key and `@retired KEY...` anywhere in a template. Blank lines and unrelated comments break the association with a key. Invalid directives produce warnings without including their arguments.
 * @example
 * parseDirectives('# @renamed-from OLD\nNEW=\n# @retired LEGACY\n').retired // => ['LEGACY']
 */
export const parseDirectives = (template: string): DirectiveSet => {
  const renamedFrom = new Map<string, string>()
  const retired = new Set<string>()
  const warnings: Warning[] = []
  const nodes = parse(template).nodes
  for (const [index, node] of nodes.entries()) {
    if (node.kind !== 'comment') continue
    const match = /^\s*#\s*@(?:migenv\s+)?([^\s]+)(?:\s+(.*?))?\s*$/.exec(node.raw)
    if (match === null) continue
    const name = match[1]
    const args = (match[2] ?? '').split(/\s+/).filter(Boolean)
    const next = nodes[index + 1]
    if (name === 'retired' && args.length > 0 && args.every((key) => KEY.test(key))) {
      for (const key of args) retired.add(key)
    } else if (
      name === 'renamed-from' &&
      args.length === 1 &&
      KEY.test(args[0] ?? '') &&
      next?.kind === 'entry' &&
      next.key !== args[0] &&
      !renamedFrom.has(next.key)
    ) {
      renamedFrom.set(next.key, args[0] as string)
    } else {
      warnings.push({
        code: 'invalid-directive',
        source: 'template',
        line: node.line,
        message: `Unsupported or malformed directive on template line ${node.line}.`,
      })
    }
  }
  return { renamedFrom, retired: [...retired], warnings }
}
