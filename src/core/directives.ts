import type { Warning } from './align'
import { parse } from './parse'

/** A template's generation groups, rename rules, retired keys and diagnostics. */
export interface DirectiveSet {
  readonly generate: readonly GenerateDirective[]
  readonly renamedFrom: ReadonlyMap<string, string>
  readonly retired: readonly string[]
  readonly warnings: readonly Warning[]
}

/** A generator specification and the consecutive entries it applies to. */
export interface GenerateDirective {
  readonly name: string
  readonly arg?: string | undefined
  readonly keys: readonly string[]
  readonly line: number
}

const KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/

/**
 * Reads `@generate name[:arg]` above consecutive entries, `@renamed-from OLD` immediately above a key, and `@retired KEY...` anywhere in a template. Blank lines and unrelated comments break the association with a key. Invalid directives produce warnings without including their arguments.
 * @example
 * parseDirectives('# @renamed-from OLD\nNEW=\n# @retired LEGACY\n').retired // => ['LEGACY']
 */
export const parseDirectives = (template: string): DirectiveSet => {
  const renamedFrom = new Map<string, string>()
  const generate: GenerateDirective[] = []
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
    if (name === 'generate' && args.length === 1 && next?.kind === 'entry') {
      const spec = /^([A-Za-z_][A-Za-z0-9_-]*)(?::([^\s:]+))?$/.exec(args[0] as string)
      if (spec !== null) {
        const keys: string[] = []
        for (const entry of nodes.slice(index + 1)) {
          if (entry.kind !== 'entry') break
          keys.push(entry.key)
          // Built-ins generate one value. Custom generators can return a consecutive key pair or group.
          if (['hex', 'base64url', 'uuid'].includes(spec[1] as string)) break
        }
        generate.push({ name: spec[1] as string, arg: spec[2], keys, line: node.line })
        continue
      }
    } else if (name === 'retired' && args.length > 0 && args.every((key) => KEY.test(key))) {
      for (const key of args) retired.add(key)
      continue
    } else if (
      name === 'renamed-from' &&
      args.length === 1 &&
      KEY.test(args[0] ?? '') &&
      next?.kind === 'entry' &&
      next.key !== args[0] &&
      !renamedFrom.has(next.key)
    ) {
      renamedFrom.set(next.key, args[0] as string)
      continue
    }
    warnings.push({
      code: 'invalid-directive',
      source: 'template',
      line: node.line,
      message: `Unsupported or malformed directive on template line ${node.line}.`,
    })
  }
  return { generate, renamedFrom, retired: [...retired], warnings }
}
