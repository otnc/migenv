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

migenv runs on Node.js 18.3 and later. The API ships as both ESM and CommonJS, with TypeScript type definitions for each.

## Usage

### Command line

```sh
npx migenv              # align .env with .env.example (same as "migenv align")
npx migenv check        # exit with 1 when .env is out of date, for CI
npx migenv diff         # show what align would change
npx migenv prune --backup # remove @retired keys after confirmation
npx migenv align .env.local --remove --protect SESSION_SECRET --backup
```

Each file uses `<file>.example` as its template. If that is missing, migenv drops the file's last suffix and tries again: `.env.local` falls back to `.env.example`. Choose a template with `-t, --template <path>`. Paths are relative to the directory you run migenv in.

CLI flags correspond to the options below. Use `npx migenv <command> --help` for each command's flags. `-p, --protect <keys>` accepts comma-separated keys or repeated flags. `--remove` and `prune` ask before deleting keys; pass `--yes` in CI. `check` and `diff` never write, and no command prints values.

| Exit code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | `check` found a file out of date |
| 2 | Usage error, missing file or template, or parse failure |

Messages are in English or Japanese, chosen by `--lang <en|ja>`, then `LC_ALL`, `LC_MESSAGES` and `LANG`.

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
// { missing: ['PORT'], empty: [], extra: ['OLD_API_KEY'], retired: [], orderDiffers: true }
```

### Rename keys

Place `@renamed-from` immediately before an uncommented key in the template:

```sh
# @renamed-from GOOGLE_ID
GOOGLE_CLIENT_ID=
```

`align` moves the old key's value to the new name when the new key is missing or empty, then removes the old name. Quotes, spacing around `=` and inline comments stay intact. `result.renamed` lists `{ from, to }` pairs. Set `rename: false` or `--no-rename` to disable renaming; `add: false` does not disable it.

A protected old or new key blocks renaming. A `rename-conflict` warning means the new key already has a value, the old key is still uncommented in the template, or the rules overlap (chains, cycles or multiple new names for one old key). Old keys absent from the template stay by default and can be deleted with `remove: true`.

### Remove unused keys

List unused keys with `@retired` anywhere in the template, separated by spaces:

```sh
# @retired REGISTRATION INVITES_PER_USER
```

`align` warns when these keys remain, and `diff(...).retired` lists them. `migenv prune` removes only these keys after confirmation, keeping protected entries and all other content. Use `--dry-run` to preview, `--yes` for CI, and `--backup` to keep the original file.

For strings, pass the keys to `prune`. For files, use `pruneFile`:

```ts
import { parseDirectives, prune } from 'migenv'
import { pruneFile } from 'migenv/node'

const directives = parseDirectives(templateText)
const result = prune(currentText, directives.retired, { protect: ['KEEP'] })
await pruneFile('.env', '.env.example', { backup: true })
```

`prune` removes every unprotected occurrence of each selected key, preserving all other bytes, including comments, unknown lines, BOM and line endings. It returns `text`, `changed`, `removed`, `protectedSkips` and `warnings`.

`pruneFile` adds the same file metadata as `migrateFile` and uses atomic writes. It supports `dryRun`, `backup`, `backupDir` and `strict` for the current file. It never creates a missing file and ignores other alignment options.

Both directives also accept the `@migenv` prefix, as in `# @migenv renamed-from GOOGLE_ID` and `# @migenv retired REGISTRATION`. Malformed or unsupported directives produce `invalid-directive` warnings with line numbers; their arguments are never shown.

## Options

`align`, `migrateFile` and `diff` take the same options object as their last argument. Every option is optional.

| Option | Default | Meaning |
| --- | --- | --- |
| `add` | `true` | Add keys that the template has and your file lacks, at the template's position |
| `remove` | `false` | Delete keys that the template does not have. When `false`, they are kept at the end |
| `rename` | `true` | Move values from keys named by `@renamed-from` when the destination is missing or empty |
| `protect` | `[]` | Keys that are never changed. `*` matches anything, as in `'*_SECRET'`. A `(key, rawValue) => boolean` function also works |
| `reorder` | `true` | Follow the template's order and comments. When `false`, keep your order and append the added keys |
| `useTemplateDefaults` | `true` | Use the template's value when yours is empty |
| `extrasHeader` | `'# ---- Not in template (review manually) ----'` | Comment placed above the keys that are not in the template, or `false` for none |
| `newline` | `'template'` | Line ending of the output: `'template'`, `'current'`, `'lf'` or `'crlf'` |
| `duplicates` | `'last'` | Which value wins when a key appears twice. `'last'` matches dotenv, and `'error'` throws |
| `strict` | `false` | Throw on lines that cannot be parsed. When `false`, they are kept with a warning |
| `backup` | `false` | Save the original to `<file>.bak.<timestamp>` before rewriting (`migrateFile` and `pruneFile` only) |
| `backupDir` | the file's directory | Where backups go (`migrateFile` and `pruneFile` only) |
| `create` | `false` | Create the file from the template when it does not exist (`migrateFile` only) |
| `dryRun` | `false` | Return the result without writing anything (`migrateFile` and `pruneFile` only) |

`protect` wins over every other option: a protected key is not filled from the template even when empty, and not deleted even with `remove: true`. Each skipped action is listed in `result.protectedSkips` and `result.warnings`.

## Errors and warnings

Errors are `MigenvError`s whose `error.code` is one of `INVALID_OPTION`, `UNKNOWN_LINE`, `DUPLICATE_KEY` and `FILE_NOT_FOUND`. Check `error.code` rather than `instanceof`, which fails when both the ESM and the CommonJS build are loaded.

A line that cannot be parsed, such as one with an unclosed quote, is kept as it is and reported by line number in `result.warnings`. Warnings and error messages name keys and line numbers only, never values.

migenv reads quotes the way dotenv does, so a quoted value whose closing quote comes right after a backslash, such as `"C:\tools\"`, can reach into the lines after it. When aligning would make such a value read differently, `align` and `migrateFile` leave the file unchanged and add an `ambiguous-quote` warning.

## What migenv does not do

- Load environment variables. Putting them into `process.env` is the job of [dotenv](https://github.com/motdotla/dotenv), Node.js's [`--env-file`](https://nodejs.org/api/cli.html#--env-filefile) or [Wrangler](https://developers.cloudflare.com/workers/configuration/environment-variables/).
- Validate values at run time. Leave types and formats to [envalid](https://github.com/af/envalid), [zod](https://zod.dev) or [Valibot](https://valibot.dev).
- Manage or encrypt secrets. Leave that to [dotenvx](https://dotenvx.com), [1Password](https://developer.1password.com/docs/cli/secrets-environment-variables/) or [Vault](https://developer.hashicorp.com/vault).

## License

[MIT](./LICENSE)
