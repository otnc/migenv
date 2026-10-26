import { basename, dirname, join } from 'node:path'

/**
 * Templates to try for `file`, most specific first: `<file>.example`, then the same with trailing `.<suffix>` parts dropped.
 * For `.env.local` that is `.env.local.example`, then `.env.example`.
 */
export function templateCandidates(file: string): string[] {
  const dir = dirname(file)
  const candidates: string[] = []
  // A leading dot belongs to the name (`.env`), so suffixes are only split off after it.
  for (let name = basename(file); ;) {
    candidates.push(join(dir, `${name}.example`))
    const cut = name.lastIndexOf('.')
    if (cut <= 0) break
    name = name.slice(0, cut)
  }
  return candidates
}
