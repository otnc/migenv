import type { ProtectedSkip, Warning } from './align'
import { parseDirectives } from './directives'
import { MigenvError } from './errors'
import { type MigenvOptions, resolveOptions } from './options'
import {
  type BlankNode,
  commentedOutKey,
  type EnvDocument,
  type EnvNode,
  parse,
  stringify,
} from './parse'

/** The template text and what `extract` did to produce it. Never includes values. */
export interface ExtractResult {
  readonly text: string
  /** Whether `text` differs from the template that was passed in, or from an empty file when there was none. */
  readonly changed: boolean
  /** Keys written to the template, as entries or as commented-out entries. */
  readonly added: readonly string[]
  /** Template entries deleted by `remove: true` because the env file does not have them. */
  readonly removed: readonly string[]
  /** Added keys whose values were copied because of `keepValues`. */
  readonly keptValues: readonly string[]
  /** Keys of commented-out entries, such as `# API_KEY=...`, left out by `commentedEntries: 'remove'`. */
  readonly droppedCommentedEntries: readonly string[]
  readonly protectedSkips: readonly ProtectedSkip[]
  readonly warnings: readonly Warning[]
}

/**
 * Builds a template such as `.env.example` from an env file. Values are emptied unless `keepValues` names the key, inline comments and unparsable lines are left out, and commented-out entries follow `commentedEntries`, which drops them by default because they often hold real values. Other comments and blank lines are copied.
 *
 * Without `template` (or with an empty one) the whole file is converted. With `template`, its existing lines are never changed: keys it lacks are inserted after the key that precedes them in the env file, together with the comment lines directly above them, and keys it names in `@retired` or `@renamed-from` are not added back. `remove: true` deletes template entries the env file does not have, except protected ones.
 * @throws {MigenvError} `UNKNOWN_LINE` in strict mode, for either input.
 * @example
 * extract('# Server\nPORT=3000\nAPI_KEY=sk-live-1\n# OLD_KEY=sk-old\n', undefined, { keepValues: ['PORT'] }).text
 * // => '# Server\nPORT=3000\nAPI_KEY=\n'
 * extract('PORT=3000\nAPI_KEY=sk-live-1\nNEW_KEY=x\n', 'PORT=\nAPI_KEY=\n').text
 * // => 'PORT=\nAPI_KEY=\nNEW_KEY=\n'
 */
export const extract = (
  current: string,
  template?: string,
  options?: MigenvOptions,
): ExtractResult => {
  const resolved = resolveOptions(options)
  const source = parse(current)
  const base = template === undefined || template.trim() === '' ? undefined : parse(template)
  const warnings: Warning[] = []
  for (const [doc, origin] of [
    [source, 'current'],
    [base, 'template'],
  ] as const) {
    for (const node of doc?.nodes ?? []) {
      if (node.kind !== 'unknown') continue
      if (resolved.strict)
        throw new MigenvError('UNKNOWN_LINE', `Line ${node.line} could not be parsed.`)
      warnings.push({
        code: 'unknown-line',
        source: origin,
        line: node.line,
        message:
          origin === 'current'
            ? `Line ${node.line} could not be parsed and was left out of the template.`
            : `Line ${node.line} of the template could not be parsed and was kept as is.`,
      })
    }
  }

  const activeKeys = new Set(
    source.nodes.flatMap((node) => (node.kind === 'entry' ? [node.key] : [])),
  )
  const added: string[] = []
  const keptValues: string[] = []
  const droppedCommentedEntries: string[] = []
  const written = new Set<string>()
  const writtenCommented = new Set<string>()

  /** The template line for an env file node, or `undefined` when it must not reach the template. */
  const templateLine = (node: EnvNode): EnvNode | undefined => {
    switch (node.kind) {
      case 'blank':
        return node
      case 'unknown':
        return undefined
      case 'entry': {
        if (written.has(node.key)) return undefined
        written.add(node.key)
        added.push(node.key)
        if (resolved.isValueKept(node.key, node.rawValue)) {
          if (!node.isEmpty) keptValues.push(node.key)
          return node
        }
        const prefix = node.raw.slice(0, node.raw.length - node.rawValue.length)
        return { ...node, raw: prefix, rawValue: '', isEmpty: true }
      }
      case 'comment': {
        const key = commentedOutKey(node)
        if (key === undefined) return node
        switch (resolved.commentedEntries) {
          case 'remove':
            droppedCommentedEntries.push(key)
            return undefined
          case 'keep':
            added.push(key)
            return node
          case 'empty': {
            // `# KEY=` next to `KEY=` would only say the same thing twice.
            if (activeKeys.has(key) || writtenCommented.has(key)) return undefined
            writtenCommented.add(key)
            added.push(key)
            const rawValue = node.raw.slice(node.raw.indexOf('=') + 1)
            if (resolved.isValueKept(key, rawValue)) {
              if (rawValue.trim() !== '') keptValues.push(key)
              return node
            }
            return { ...node, raw: node.raw.slice(0, node.raw.indexOf('=') + 1) }
          }
        }
      }
    }
  }

  const result = (
    doc: EnvDocument,
    nodes: readonly EnvNode[],
    removed: readonly string[],
    protectedSkips: readonly ProtectedSkip[],
  ): ExtractResult => {
    const withEndings = nodes.map((node, index): EnvNode => {
      const last = index === nodes.length - 1
      if (last) return { ...node, eol: doc.finalNewline ? node.eol || doc.newline : '' }
      return node.eol === '' ? { ...node, eol: doc.newline } : node
    })
    const text = stringify({ ...doc, nodes: withEndings })
    const reparsed = parse(text).nodes
    const previous = template ?? ''
    // A kept value or a template line ending in a backslash can make a quote reach into the next line.
    if (
      reparsed.length !== withEndings.length ||
      reparsed.some((node, index) => node.raw !== withEndings[index]?.raw)
    ) {
      return {
        text: previous,
        changed: false,
        added: [],
        removed: [],
        keptValues: [],
        droppedCommentedEntries,
        protectedSkips,
        warnings: [
          ...warnings,
          {
            code: 'ambiguous-quote',
            source: 'template',
            message:
              'The template was left unchanged because extracting would change how a quoted value reads.',
          },
        ],
      }
    }
    return {
      text,
      changed: text !== previous,
      added,
      removed,
      keptValues,
      droppedCommentedEntries,
      protectedSkips,
      warnings,
    }
  }

  if (base === undefined) {
    const nodes: EnvNode[] = []
    let droppedSinceLastLine = false
    for (const node of source.nodes) {
      const line = templateLine(node)
      if (line === undefined) {
        droppedSinceLastLine = true
        continue
      }
      // Leaving out a line must not leave two blank lines, or one at the top, where there were none.
      const previous = nodes[nodes.length - 1]
      if (
        line.kind === 'blank' &&
        droppedSinceLastLine &&
        (previous === undefined || previous.kind === 'blank')
      )
        continue
      nodes.push(line)
      droppedSinceLastLine = false
    }
    while (droppedSinceLastLine && nodes[nodes.length - 1]?.kind === 'blank') nodes.pop()
    return result(source, nodes, [], [])
  }

  const directives = parseDirectives(template as string)
  warnings.push(...directives.warnings)
  const templateKeys = (node: EnvNode): string | undefined =>
    node.kind === 'entry' ? node.key : node.kind === 'comment' ? commentedOutKey(node) : undefined
  const inTemplate = new Set(base.nodes.flatMap((node) => templateKeys(node) ?? []))
  const retiredOrRenamed = new Set([...directives.retired, ...directives.renamedFrom.values()])

  // Each group of new lines goes after a key the template already has, or at the end (`undefined`).
  const groups = new Map<string | undefined, EnvNode[]>()
  const groupOfAddedKey = new Map<string, string | undefined>()
  let anchor: string | undefined
  let commentsAbove: EnvNode[] = []
  for (const node of source.nodes) {
    const key = templateKeys(node)
    if (node.kind === 'comment' && key === undefined) {
      commentsAbove.push(node)
      continue
    }
    const attached = commentsAbove
    commentsAbove = []
    if (key === undefined) continue
    if (inTemplate.has(key) || groupOfAddedKey.has(key)) {
      anchor = key
      continue
    }
    if (retiredOrRenamed.has(key)) continue
    const line = templateLine(node)
    if (line === undefined) continue
    const group = groupOfAddedKey.has(anchor as string)
      ? groupOfAddedKey.get(anchor as string)
      : anchor
    const lines = [...attached, line].map((added): EnvNode => ({ ...added, eol: base.newline }))
    groups.set(group, [...(groups.get(group) ?? []), ...lines])
    groupOfAddedKey.set(key, group)
    anchor = key
  }

  const removed: string[] = []
  const protectedSkips: ProtectedSkip[] = []
  const nodes: EnvNode[] = []
  for (const node of base.nodes) {
    const unused = resolved.remove && node.kind === 'entry' && !activeKeys.has(node.key)
    const protectedFromRemoval = unused && resolved.isProtected(node.key, node.rawValue)
    if (unused && !protectedFromRemoval) {
      if (!removed.includes(node.key)) removed.push(node.key)
    } else nodes.push(node)
    if (protectedFromRemoval && node.kind === 'entry') {
      if (!protectedSkips.some((skip) => skip.key === node.key)) {
        protectedSkips.push({ key: node.key, action: 'remove' })
        warnings.push({
          code: 'protected',
          source: 'template',
          key: node.key,
          message: `"${node.key}" is protected and was kept.`,
        })
      }
    }
    const key = templateKeys(node)
    const group = key === undefined ? undefined : groups.get(key)
    if (group === undefined) continue
    nodes.push(...group)
    groups.delete(key)
  }
  const tail = groups.get(undefined) ?? []
  const last = nodes[nodes.length - 1]
  if (tail[0]?.kind === 'comment' && last !== undefined && last.kind !== 'blank') {
    const separator: BlankNode = { kind: 'blank', raw: '', line: 0, eol: base.newline }
    nodes.push(separator)
  }
  nodes.push(...tail)
  return result(base, nodes, removed, protectedSkips)
}
