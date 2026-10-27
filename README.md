# migenv

**English** | [日本語](README.ja.md)

[![npm](https://img.shields.io/npm/v/migenv)](https://www.npmjs.com/package/migenv)
[![CI](https://github.com/otnc/migenv/actions/workflows/ci.yml/badge.svg)](https://github.com/otnc/migenv/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/migenv)](https://www.npmjs.com/package/migenv)
[![license](https://img.shields.io/npm/l/migenv)](./LICENSE)

Migrate `.env` and `.dev.vars` files to match their `.example` templates without changing existing values.

migenv reorders your env file to follow its template and adds the keys it is missing. **Alignment and generation never change a non-empty value, not even by one character.** To explicitly overwrite selected values, use `setValues`.

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

### Set values explicitly

`setValues` overwrites selected keys, including non-empty values. Pass a `ReadonlyMap<string, string>` containing raw env syntax after `=`, including any quotes and inline comments. Values are not decoded or automatically escaped, so `new Map([['LABEL', '"hello # world"']])` writes `LABEL="hello # world"`.

```ts
import { setValues } from 'migenv'

const result = setValues(currentText, new Map([
  ['ORIGIN', 'https://example.com'],
  ['LABEL', '"hello # world"'],
]), { protect: ['SESSION_SECRET'] })

result.text    // updated env content
result.updated // existing keys whose raw values changed
result.added   // missing keys added in map order
result.skipped // protected keys, or missing keys with add: false
```

Unrelated lines, comments, BOM, mixed line endings and the existing final-newline style stay intact. Updated entries keep their key prefix, including `export` and spacing before `=`; their entire raw value is replaced. Missing keys are appended using the current file's line ending (LF for an empty file), or inserted before the first unparseable line. Set `add: false` to update existing keys only.

All occurrences of a requested key are updated together so a later duplicate cannot hide an update. `duplicates: 'first'` and `'last'` both keep and update every occurrence; `'error'` rejects duplicate keys. If `protect` matches any occurrence, the entire key is skipped. Protection also prevents adding a missing key. `strict: true` rejects unparseable lines; otherwise they are kept with warnings. Other alignment and file options are ignored.

Quoted multiline values are supported. Invalid keys, unclosed quotes and raw values that introduce extra entries throw `INVALID_VALUE`, with no values in the message. If combining valid entries would change how neighboring quoted values read, the original text is returned with an `ambiguous-quote` warning and every requested key in `skipped`. Reapplying the same values changes nothing. For file or remote operations, pass the returned text to your existing write operation; `writeFileAtomic` is available from `migenv/node`.

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

### Generate empty values

Place `@generate` immediately above an empty key in the template:

```sh
# @generate base64url:32
SESSION_SECRET=

# @generate hex:32
ENCRYPTION_KEY=

# @generate uuid
INSTANCE_ID=
```

`hex` and unpadded `base64url` accept a byte length from 1 to 65536 (default 32). `uuid` produces a UUID v4 and takes no argument. Built-ins apply only to the next key. `@migenv generate` also works.

```sh
npx migenv fill           # fill existing empty keys, preserving layout
npx migenv init           # create or align .env, then fill empty keys
npx migenv align --fill   # align and fill an existing file
npx migenv fill --dry-run # preview key names without writing
```

Ordinary `align` never generates values. Non-empty values and protected keys stay intact, including on repeated runs. `init` accepts paths such as `.dev.vars` and updates existing files using the same rules as `align`. `fill` never adds keys or creates a missing file. Both commands support `--backup`, `--dry-run` and `--protect`. Output contains key names only.

```ts
import { fillFile, migrateFile } from 'migenv/node'

const result = await fillFile('.env', '.env.example', { backup: true })
console.log(result.filled) // generated key names only
await migrateFile('.dev.vars', '.dev.vars.example', { create: true, fill: true })
```

For strings, `fill(text, options)` from `migenv` reads directives from the text itself. `align(current, template, { fill: true })` uses the template's directives, including with `reorder: false`. Built-in string generators require global Web Crypto. On Node 18, use the file APIs, enable `--experimental-global-webcrypto`, or provide custom generators. File APIs and the CLI use `node:crypto` and support Node 18.3 and later.

Custom synchronous generators go in `options.generators`. They receive `{ keys, arg }` and return a record with exactly those keys and their values. A custom directive applies to consecutive entries until the next comment or blank line. To preserve paired secrets, the entire group is skipped if a key is missing, protected, duplicated or already has a value. Configuration-file loading is not implemented yet; pass custom generators through the library API.

```ts
import { fill, type Generator } from 'migenv'

const pair: Generator = () => createKeyPair() // returns { PUBLIC_KEY, PRIVATE_KEY }
const result = fill('# @generate pair\nPUBLIC_KEY=\nPRIVATE_KEY=\n', {
  generators: { pair },
})
```

Generated values must be non-empty single-line strings. Spaces and comment characters are quoted; values containing every supported quote delimiter or ending in a backslash are rejected. Generation errors use `GENERATION_FAILED`, omitting generated values and original exceptions. Generation completes before any file write or backup.

## Options

`align`, `migrateFile` and `diff` take the same options object as their last argument. Every option is optional.

| Option | Default | Meaning |
| --- | --- | --- |
| `add` | `true` | Add keys that the template has and your file lacks, at the template's position |
| `remove` | `false` | Delete keys that the template does not have. When `false`, they are kept at the end |
| `rename` | `true` | Move values from keys named by `@renamed-from` when the destination is missing or empty |
| `fill` | `false` | Generate empty values after alignment using the template's `@generate` directives |
| `generators` | `{}` | Custom synchronous generators, overriding built-ins with the same name |
| `protect` | `[]` | Keys that are never changed. `*` matches anything, as in `'*_SECRET'`. A `(key, rawValue) => boolean` function also works |
| `reorder` | `true` | Follow the template's order and comments. When `false`, keep your order and append the added keys |
| `useTemplateDefaults` | `true` | Use the template's value when yours is empty |
| `extrasHeader` | `'# ---- Not in template (review manually) ----'` | Comment placed above the keys that are not in the template, or `false` for none |
| `newline` | `'template'` | Line ending of the output: `'template'`, `'current'`, `'lf'` or `'crlf'` |
| `duplicates` | `'last'` | Which value wins when a key appears twice. `'last'` matches dotenv, and `'error'` throws |
| `strict` | `false` | Throw on lines that cannot be parsed. When `false`, they are kept with a warning |
| `backup` | `false` | Save the original to `<file>.bak.<timestamp>` before rewriting (file APIs only) |
| `backupDir` | the file's directory | Where backups go (file APIs only) |
| `create` | `false` | Create the file from the template when it does not exist (`migrateFile` only) |
| `dryRun` | `false` | Return the result without writing anything (file APIs only) |

`protect` wins over every other option: a protected key is not filled from the template even when empty, and not deleted even with `remove: true`. Each skipped action is listed in `result.protectedSkips` and `result.warnings`.

## Errors and warnings

Errors are `MigenvError`s whose `error.code` is one of `INVALID_OPTION`, `INVALID_VALUE`, `UNKNOWN_LINE`, `DUPLICATE_KEY`, `FILE_NOT_FOUND` and `GENERATION_FAILED`. Check `error.code` rather than `instanceof`, which fails when both the ESM and the CommonJS build are loaded.

A line that cannot be parsed, such as one with an unclosed quote, is kept as it is and reported by line number in `result.warnings`. Warnings and error messages name keys and line numbers only, never values.

migenv reads quotes the way dotenv does, so a quoted value whose closing quote comes right after a backslash, such as `"C:\tools\"`, can reach into the lines after it. When aligning would make such a value read differently, `align` and `migrateFile` leave the file unchanged and add an `ambiguous-quote` warning.

## What migenv does not do

- Load environment variables. Putting them into `process.env` is the job of [dotenv](https://github.com/motdotla/dotenv), Node.js's [`--env-file`](https://nodejs.org/api/cli.html#--env-filefile) or [Wrangler](https://developers.cloudflare.com/workers/configuration/environment-variables/).
- Validate values at run time. Leave types and formats to [envalid](https://github.com/af/envalid), [zod](https://zod.dev) or [Valibot](https://valibot.dev).
- Manage or encrypt secrets. Leave that to [dotenvx](https://dotenvx.com), [1Password](https://developer.1password.com/docs/cli/secrets-environment-variables/) or [Vault](https://developer.hashicorp.com/vault).

## License

[MIT](./LICENSE)
