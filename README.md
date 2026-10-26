# migenv

**English** | [日本語](README.ja.md)

[![npm](https://img.shields.io/npm/v/migenv)](https://www.npmjs.com/package/migenv)
[![CI](https://github.com/otnc/migenv/actions/workflows/ci.yml/badge.svg)](https://github.com/otnc/migenv/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/migenv)](https://www.npmjs.com/package/migenv)
[![license](https://img.shields.io/npm/l/migenv)](./LICENSE)

Migrate `.env` and `.dev.vars` files to match their `.example` templates without changing existing values.

migenv reorders your env file to follow its template and adds the keys it is missing. **A non-empty value is never changed, not even by one character.**

## What it does

Say the template `.env.example` looks like this:

```sh
# App
APP_URL=http://localhost:3000
PORT=3000

# Database
DATABASE_URL=
# SENTRY_DSN=

# Auth
SESSION_SECRET=
```

Your `.env` is out of order, lacks `PORT`, and still has `OLD_API_KEY`, which nothing uses anymore.

```sh
DATABASE_URL=postgres://localhost/app
SESSION_SECRET=s3cr3t
APP_URL=https://dev.example.com
OLD_API_KEY=abc123
SENTRY_DSN=https://key@sentry.io/1
```

After migenv:

```sh
# App
APP_URL=https://dev.example.com
PORT=3000

# Database
DATABASE_URL=postgres://localhost/app
SENTRY_DSN=https://key@sentry.io/1

# Auth
SESSION_SECRET=s3cr3t

# ---- Not in template (review manually) ----
OLD_API_KEY=abc123
```

- The order and the comments now match the template.
- `PORT` is added with the template's value, `3000`.
- Every value is kept as it was. `APP_URL` does not go back to the template's `http://localhost:3000`.
- `# SENTRY_DSN=`, commented out in the template, marks an optional key. Your value takes its place.
- `OLD_API_KEY` is not in the template, so it is collected at the end instead of being deleted. Pass `remove: true` to delete it.

## Install

```sh
npm install --save-dev migenv
```

migenv runs on Node.js 18 and later. It ships as both ESM and CommonJS, with TypeScript type definitions for each.

## Usage

### Rewrite a file

Pass the env file and its template to `migrateFile` from `migenv/node`.

```ts
import { migrateFile } from 'migenv/node'

const result = await migrateFile('.env', '.env.example', {
  remove: true,
  protect: ['SESSION_SECRET', 'ENCRYPTION_KEY'],
  backup: true,
})

console.log(result.added) // keys added from the template
console.log(result.removed) // keys deleted by remove: true
console.log(result.backupPath) // where the original content was saved
```

The new content goes to a temporary file in the same directory, which then replaces the original, so a crash never leaves a half-written file. An existing file keeps its permissions, and new files and backups are created with mode `0o600`. When the result is the same as before, neither the file nor its timestamp is touched.

### Align strings

When there is no file to work on, pass strings to `align` from `migenv`. It uses no Node.js API.

```ts
import { align } from 'migenv'

const result = align(currentText, templateText, { remove: true })
result.text // the aligned content
result.changed // true when it differs from currentText
```

### Check without rewriting

`diff` reports the differences and changes nothing, which is handy for catching drift in CI.

```ts
import { diff } from 'migenv'

const report = diff(currentText, templateText)
// { missing: ['PORT'], empty: [], extra: ['OLD_API_KEY'], orderDiffers: true }
```

## Options

`align`, `migrateFile` and `diff` take the same options object as their last argument. Every option is optional.

| Option | Default | Meaning |
| --- | --- | --- |
| `add` | `true` | Add keys that the template has and your file lacks, at the template's position |
| `remove` | `false` | Delete keys that the template does not have. When `false`, they are kept at the end |
| `protect` | `[]` | Keys that are never changed. `*` matches anything, as in `'*_SECRET'`. A `(key, rawValue) => boolean` function also works |
| `reorder` | `true` | Follow the template's order and comments. When `false`, keep your order and append the added keys |
| `useTemplateDefaults` | `true` | Use the template's value when yours is empty |
| `extrasHeader` | `'# ---- Not in template (review manually) ----'` | Comment placed above the keys that are not in the template, or `false` for none |
| `newline` | `'template'` | Line ending of the output: `'template'`, `'current'`, `'lf'` or `'crlf'` |
| `duplicates` | `'last'` | Which value wins when a key appears twice. `'last'` matches dotenv, and `'error'` throws |
| `strict` | `false` | Throw on lines that cannot be parsed. When `false`, they are kept with a warning |
| `backup` | `false` | Save the original to `<file>.bak.<timestamp>` before rewriting (`migrateFile` only) |
| `backupDir` | the file's directory | Where backups go (`migrateFile` only) |
| `create` | `false` | Create the file from the template when it does not exist (`migrateFile` only) |
| `dryRun` | `false` | Return the result without writing anything (`migrateFile` only) |

`protect` wins over every other option: a protected key is not filled from the template even when empty, and not deleted even with `remove: true`. Each skipped action is listed in `result.protectedSkips` and `result.warnings`.

## Errors and warnings

Errors are `MigenvError`s whose `error.code` is one of `INVALID_OPTION`, `UNKNOWN_LINE`, `DUPLICATE_KEY` and `FILE_NOT_FOUND`. Check `error.code` rather than `instanceof`, which fails when both the ESM and the CommonJS build are loaded.

A line that cannot be parsed, such as one with an unclosed quote, is kept as it is and reported by line number in `result.warnings`. Warnings and error messages name keys and line numbers only, never values.

## What migenv does not do

- Load environment variables. Putting them into `process.env` is the job of dotenv, Node.js's `--env-file` or Wrangler.
- Validate values at run time. Leave types and formats to envalid or zod.
- Manage or encrypt secrets. Leave that to dotenvx, 1Password or Vault.
- Scan source code. Checking that every `process.env.X` is in `.env.example` is what dotenv-align does.

## License

[MIT](./LICENSE)
