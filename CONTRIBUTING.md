# Contributing

Thanks for your interest in improving migenv! This guide gets you set up and explains how the project is put together. If anything here is unclear, opening an issue to ask is welcome.

## Getting set up

Development needs Node.js 24 (see `.nvmrc`), because vitest, tsdown and ESLint require Node 22 or later. The published package itself supports Node.js 18 and later.

```sh
npm install
```

Commit `package-lock.json` along with any dependency change.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Bundle ESM/CJS + type declarations with tsdown |
| `npm run test` | Run the tests once with vitest (`npm run test:watch` to keep them running) |
| `npm run test:coverage` | Run the tests with a coverage report |
| `npm run test:compat` | Load the built `dist` through `import` and `require` with `node:test` (what CI runs on Node 18 and 20) |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run format` | Format the code, writing the fixes (Prettier) |
| `npm run format:check` | Check formatting without writing (Prettier) |
| `npm run lint` | Lint the code, including the Node 18 compatibility check (ESLint) |
| `npm run lint:fix` | Lint the code, writing the fixes (ESLint) |
| `npm run lint:pkg` | Check `package.json` and the built types with publint and attw (run `build` first) |
| `npm run check` | Format and lint, writing the fixes |
| `npm run ci` | The same checks without writing (what CI runs) |

Before opening a pull request, make sure the full set passes:

```sh
npm run ci && npm run typecheck && npm run test && npm run build && npm run lint:pkg && npm run test:compat
```

## How the code is organized

The package has two entry points, and every file you add must be exported from one of them or the build leaves it out.

| Path | Entry | What it holds |
| --- | --- | --- |
| `src/core/parse.ts` | `migenv` | `parse` and `stringify`: a lossless syntax tree of an env file |
| `src/core/options.ts` | `migenv` | `MigenvOptions`, `resolveOptions` and the `protect` patterns |
| `src/core/align.ts` | `migenv` | `align`: rewrites a file to follow its template |
| `src/core/diff.ts` | `migenv` | `diff`: reports what `align` would change, without changing it |
| `src/core/errors.ts` | `migenv` | `MigenvError` and its codes |
| `src/node/file.ts` | `migenv/node` | `migrateFile` and `writeFileAtomic` |

`src/core` only works on strings and must not import any Node API, so it stays usable outside Node. File system code belongs in `src/node`.

## Rules the code keeps

These are the promises migenv makes to its users. A change that breaks one of them is a bug, even if every test passes.

- **Non-empty values never change.** `parse` does not decode values; it keeps each line's text as `raw` so that `stringify(parse(text)) === text` holds for any input, and `align` copies current lines as they are.
- **`align` is idempotent.** Running it on its own output changes nothing.
- **Lines that cannot be parsed are kept**, never dropped. They become `unknown` nodes and a warning.
- **Values never appear in messages.** Warnings and errors name keys and line numbers only, because env files hold secrets.
- **Callers check `error.code`, not `instanceof MigenvError`.** The ESM and CJS builds each define the class, so `instanceof` fails when both are loaded.

## Conventions

- **Formatting is Prettier** (`.prettierrc.json`): single quotes, no semicolons, trailing commas, 100-column width. Markdown, `package.json`, `package-lock.json` and fixtures are left alone (`.prettierignore`). Running `npm run check` before you commit handles formatting and auto-fixable lint errors.
- **Linting is ESLint** (`eslint.config.js`) with `@eslint/js`, type-aware `typescript-eslint` and `eslint-plugin-n`. The `n` rules reject Node APIs and built-ins that Node 18 lacks, such as `util.styleText` and `Object.groupBy`, in `src/` (tests are exempt because they run on Node 22+ only). `tsconfig.json` also limits `lib` to ES2022 for the same reason.
- **Tests live next to the code** as `*.test.ts` and run with vitest. Test only behavior a user relies on, not how the code happens to do it.
- **`align` cases are fixtures.** Each directory under `test/fixtures/align/` holds `current.env`, `template.env`, `expected.env` and, when the case needs options, `options.json`. Adding a directory adds a case; `test/align.fixtures.test.ts` and `test-compat/` both run every one. Git keeps fixture bytes as-is (CRLF, BOM, missing final newline).
- **The rules above are property tests** with fast-check, in `src/core/*.test.ts`. The env file generators live in `test/helpers.ts`.
- **Fixture files must not be named `.env*`**, because `.gitignore` ignores those. Use names like `current.env` and `template.env`.
- **Comments and docs are in English** and kept brief.
- **Type-only imports use `import type`** (`verbatimModuleSyntax` is on).
- **Exported functions declare their return types** (`isolatedDeclarations` is on).

## Pull requests

Keep each change focused and add tests for any new behaviour. Work on a branch named after the kind of change (`feat/…`, `fix/…`, `refactor/…`, `test/…`, `docs/…`, `chore/…`), and keep each commit to one change, with a message that starts with the same prefix, such as `feat: add diff`.

## Releasing (maintainers)

Releasing is one manual step. From the Actions tab, run the `release` workflow (`workflow_dispatch`) and give it a `version` input: either a bump keyword (`patch` / `minor` / `major` / `prerelease`) or an explicit version like `0.1.0`. The workflow runs the checks and build, bumps `package.json`, publishes to npm with provenance via **trusted publishing** (OIDC, no `NPM_TOKEN` needed), pushes the version commit and tag, and creates a GitHub Release with generated notes.

Trusted publishing must be configured once on npmjs.com: in the package's **Settings → Publishing access → Trusted publishers → GitHub**, point it at this repository's `release.yml` workflow.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
