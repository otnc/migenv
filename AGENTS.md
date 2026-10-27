# AGENTS.md

migenv is an npm package that brings `.env` and `.dev.vars` files in line with their templates (`.env.example` and the like) without changing any existing non-empty value. Only `setValues` explicitly overwrites requested values, while still respecting `protect`. It has two library entry points, `migenv` (`src/core`, string-only) and `migenv/node` (`src/node`, file system), and a `migenv` command (`src/cli`).

[CONTRIBUTING.md](CONTRIBUTING.md) is the full guide. Read its "How the code is organized" and "Rules the code keeps" sections before changing `src/`.

## Commands

- Install: `npm install` (Node 24, see `.nvmrc`)
- Tests: `npm run test`, or one file with `npx vitest run src/core/align.test.ts`
- Types: `npm run typecheck`
- Format and lint: `npm run ci` to check, `npm run check` to fix
- Package shape: `npm run build && npm run lint:pkg`
- Node 18 and 20 loading: `npm run build && npm run test:compat`

Run `npm run ci && npm run typecheck && npm run test` before saying a change is done.

## Things that are easy to get wrong

- The published package supports Node 18.3 and later (citty needs `util.parseArgs`), but development runs on Node 24. In `src/`, do not use APIs that Node 18 lacks; ESLint (`n/no-unsupported-features/...`) and `lib: ES2022` in `tsconfig.json` (`TS2550`) catch most of them. Tests are exempt.
- `isolatedDeclarations` is on, so every exported function and constant needs an explicit type. `TS90xx` errors mean one is missing.
- `exactOptionalPropertyTypes` is on. Option properties are typed `T | undefined` on purpose, because `undefined` means "not set".
- Never put a value from an env file into a warning, an error message or a log.
- `src/core` must not import from `node:*`.
- Fixture files must not be named `.env*`, because `.gitignore` ignores those.
- Every new source file must be exported from `src/core/index.ts` or `src/node/index.ts`, or imported from `src/cli/bin.ts`, or the build leaves it out.
- Every message the CLI prints lives in `src/cli/messages.i18n.ts` with both `en` and `ja`. `npm run docs:check` fails when one is missing.
- `README.md` and `README.ja.md` are generated. Edit `base/README.base.md`, then run `npm run docs:build` and `npm run docs:check`.

## Skills

Project skills live in `.agents/skills/` and are pinned in `skills-lock.json`. `.claude/skills/` only holds links to them and is not committed; run `npx skills experimental_install` to recreate it.

- `typescript-design`: when designing, writing or refactoring TypeScript
- `hush`, `hush-review`, `hush-fix`: when writing or reviewing comments
- `fix-unnatural-line-breaks`: when writing Markdown or comments
- `kiritan`: when editing the README, which is generated from `base/README.base.md`
- `natural-japanese`, `stop-ai-slop-jp`: when writing Japanese text

## Writing

- Code, comments, docs, commit messages and PR text are in English.
- Comments are minimal: name things so that they need none, document exported APIs with JSDoc and an example, and comment only what a reader could misread.
- Do not wrap prose at a fixed width. Break lines only at paragraph, list item and heading boundaries, in Markdown and comments alike.
- Branches and commits follow the prefixes in CONTRIBUTING.md (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`), one change per commit.
