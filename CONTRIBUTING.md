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

## Conventions

- **Formatting is Prettier** (`.prettierrc.json`): single quotes, no semicolons, trailing commas, 100-column width. Markdown, `package.json`, `package-lock.json` and fixtures are left alone (`.prettierignore`). Running `npm run check` before you commit handles formatting and auto-fixable lint errors.
- **Linting is ESLint** (`eslint.config.js`) with `@eslint/js`, type-aware `typescript-eslint` and `eslint-plugin-n`. The `n` rules reject Node APIs and built-ins that Node 18 lacks, such as `util.styleText` and `Object.groupBy`, in `src/` (tests are exempt because they run on Node 22+ only). `tsconfig.json` also limits `lib` to ES2022 for the same reason.
- **Tests live next to the code** as `*.test.ts` and run with vitest. Fixture files go under `test/fixtures/`, and git keeps their bytes as-is (CRLF, BOM, missing final newline).
- **Fixture files must not be named `.env*`**, because `.gitignore` ignores those. Use names like `current.env` and `template.env`.
- **Comments and docs are in English** and kept brief.
- **Type-only imports use `import type`** (`verbatimModuleSyntax` is on).
- **Exported functions declare their return types** (`isolatedDeclarations` is on).

## Pull requests

Keep each change focused and add tests for any new behaviour.

## Releasing (maintainers)

Releasing is one manual step. From the Actions tab, run the `release` workflow (`workflow_dispatch`) and give it a `version` input: either a bump keyword (`patch` / `minor` / `major` / `prerelease`) or an explicit version like `0.1.0`. The workflow runs the checks and build, bumps `package.json`, publishes to npm with provenance via **trusted publishing** (OIDC, no `NPM_TOKEN` needed), pushes the version commit and tag, and creates a GitHub Release with generated notes.

Trusted publishing must be configured once on npmjs.com: in the package's **Settings → Publishing access → Trusted publishers → GitHub**, point it at this repository's `release.yml` workflow.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
