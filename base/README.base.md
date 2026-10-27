# migenv

[![npm](https://img.shields.io/npm/v/migenv)](https://www.npmjs.com/package/migenv)
[![CI](https://github.com/otnc/migenv/actions/workflows/ci.yml/badge.svg)](https://github.com/otnc/migenv/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/migenv)](https://www.npmjs.com/package/migenv)
[![license](https://img.shields.io/npm/l/migenv)](./LICENSE)

:::kiritan{locale=en}
Migrate `.env` and `.dev.vars` files to match their `.example` templates without changing existing values.

migenv reorders your env file to follow its template and adds the keys it is missing. **A non-empty value is never changed, not even by one character.**
:::
:::kiritan{locale=ja}
`.env` や `.dev.vars` の並びを、`.env.example` などのテンプレートに揃え、不足しているキーを追加します。**空でない既存の値は 1 文字も変えません。**
:::

:::kiritan{locale=en}
## What it does

Say the template `.env.example` looks like this:
:::
:::kiritan{locale=ja}
## 何をするか

テンプレートの `.env.example` が次のようになっているとします。
:::

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

:::kiritan{locale=en}
Your `.env` is out of order, lacks `PORT`, and still has `OLD_API_KEY`, which nothing uses anymore.
:::
:::kiritan{locale=ja}
手元の `.env` は、並びがばらばらで、`PORT` がなく、もう使わない `OLD_API_KEY` が残っています。
:::

```sh
DATABASE_URL=postgres://localhost/app
SESSION_SECRET=s3cr3t
APP_URL=https://dev.example.com
OLD_API_KEY=abc123
SENTRY_DSN=https://key@sentry.io/1
```

:::kiritan{locale=en}
After migenv:
:::
:::kiritan{locale=ja}
migenv で揃えると、こうなります。
:::

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

:::kiritan{locale=en}
- The order and the comments now match the template.
- `PORT` is added with the template's value, `3000`.
- Every value is kept as it was. `APP_URL` does not go back to the template's `http://localhost:3000`.
- `# SENTRY_DSN=`, commented out in the template, marks an optional key. Your value takes its place.
- `OLD_API_KEY` is not in the template, so it is collected at the end instead of being deleted. Pass `remove: true` to delete it.
:::
:::kiritan{locale=ja}
- 並びとコメントは、テンプレートと同じになります
- 不足していた `PORT` を、テンプレートの値 `3000` で追加します
- 既存の値はそのままです。`APP_URL` もテンプレートの `http://localhost:3000` に戻りません
- テンプレートでコメントアウトされた `# SENTRY_DSN=` は、任意のキーとして扱います。手元に値があれば、その位置に入ります
- テンプレートにない `OLD_API_KEY` は、消さずに末尾へまとめます。消したいときは `remove: true` を渡します
:::

:::kiritan{locale=en}
## Install
:::
:::kiritan{locale=ja}
## インストール
:::

```sh
npm install --save-dev migenv
```

:::kiritan{locale=en}
migenv runs on Node.js 18.3 and later. The API ships as both ESM and CommonJS, with TypeScript type definitions for each.
:::
:::kiritan{locale=ja}
Node.js 18.3 以降で動きます。API は ESM と CommonJS に対応し、TypeScript の型定義も付属します。
:::

:::kiritan{locale=en}
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
:::
:::kiritan{locale=ja}
## 使い方

### コマンドライン

```sh
npx migenv              # .env を .env.example に揃える ("migenv align" と同じ)
npx migenv check        # .env がずれていれば exit 1 で終える。CI 用
npx migenv diff         # align で何が変わるかを表示する
npx migenv prune --backup # @retired のキーを、確認してから消す
npx migenv align .env.local --remove --protect SESSION_SECRET --backup
```

テンプレートには `<ファイル>.example` を使います。見つからなければファイル名の最後の拡張子を外して探すので、`.env.local` には `.env.example` を使えます。別のテンプレートを指定するには `-t, --template <パス>` を渡します。パスの基準は、migenv を実行したディレクトリです。

CLI のフラグは、下のオプションに対応しています。コマンドごとの一覧は `npx migenv <コマンド> --help` で確認できます。`-p, --protect <キー>` は、カンマ区切りでも繰り返しても指定できます。`--remove` と `prune` は削除前に確認するので、CI では `--yes` を付けてください。`check` と `diff` は何も書き換えず、どのコマンドも値を表示しません。

| 終了コード | 意味 |
| --- | --- |
| 0 | 成功 |
| 1 | `check` でテンプレートとのずれを検出 |
| 2 | 引数が不正、ファイルやテンプレートがない、解析に失敗 |

表示言語は英語か日本語です。`--lang <en|ja>`、`LC_ALL`、`LC_MESSAGES`、`LANG` の順に優先します。
### ファイルを書き換える

`migenv/node` の `migrateFile` に、対象のファイルとテンプレートのパスを渡します。

```ts
import { migrateFile } from 'migenv/node'

const result = await migrateFile('.env', '.env.example', {
  remove: true,
  protect: ['SESSION_SECRET', 'ENCRYPTION_KEY'],
  backup: true,
})

console.log(result.added) // テンプレートから足したキー
console.log(result.removed) // remove: true で消したキー
console.log(result.backupPath) // 元の内容を残したバックアップのパス
```

同じディレクトリの一時ファイルに書いてから元のファイルと置き換えるため、書き込みが中断しても、書きかけの内容は残りません。既存のファイルの権限は引き継ぎ、新しいファイルとバックアップは `0o600` で作ります。内容が変わらなければ、ファイルもタイムスタンプも更新しません。
:::

:::kiritan{locale=en}
### Align strings

When there is no file to work on, pass strings to `align` from `migenv`. It uses no Node.js API.

```ts
import { align } from 'migenv'

const result = align(currentText, templateText, { remove: true })
result.text // the aligned content
result.changed // true when it differs from currentText
```
:::
:::kiritan{locale=ja}
### 文字列のまま揃える

`migenv` の `align` に文字列を渡すと、ファイルを読み書きせずに揃えられます。Node.js の API は使いません。

```ts
import { align } from 'migenv'

const result = align(currentText, templateText, { remove: true })
result.text // 揃えた内容
result.changed // 元と違えば true
```
:::

:::kiritan{locale=en}
### Check without rewriting

`diff` reports the differences and changes nothing, which is handy for catching drift in CI.

```ts
import { diff } from 'migenv'

const report = diff(currentText, templateText)
// { missing: ['PORT'], empty: [], extra: ['OLD_API_KEY'], retired: [], orderDiffers: true }
```
:::
:::kiritan{locale=ja}
### 書き換えずに調べる

`diff` は、不足しているキーや並びの違いを返します。CI での確認などに使えます。

```ts
import { diff } from 'migenv'

const report = diff(currentText, templateText)
// { missing: ['PORT'], empty: [], extra: ['OLD_API_KEY'], retired: [], orderDiffers: true }
```
:::

:::kiritan{locale=en}
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
:::
:::kiritan{locale=ja}
### キー名の変更

テンプレートのキーの直前に、変更前の名前を `@renamed-from` で指定します。キーはコメントアウトせずに書いてください。

```sh
# @renamed-from GOOGLE_ID
GOOGLE_CLIENT_ID=
```

`align` は、新しいキーがないか値が空なら、古いキーの値を引き継いで名前を変えます。クォート、`=` の前後の空白、行末コメントもそのままです。`result.renamed` には、変更前後の名前が `{ from, to }` の形で入ります。`rename: false` または `--no-rename` で名前の変更を止められます。`add: false` でも名前の変更は行います。

変更前か変更後のキーが `protect` の対象なら、名前を変えません。新しいキーに値があるか、古いキーがテンプレートにコメントアウトされずに残っているときは、`rename-conflict` の警告を出します。変更の指定が連鎖・循環しているときや、一つのキーに複数の新しい名前を指定したときも同じです。テンプレートにない古いキーは既定では残り、`remove: true` なら削除の対象になります。

### 使わなくなったキーの削除

テンプレートの任意の場所に、使わなくなったキーを `@retired` で指定します。複数あるときは空白で区切ります。

```sh
# @retired REGISTRATION INVITES_PER_USER
```

`align` は、指定したキーが残っていれば警告します。`diff(...).retired` でも一覧を取得できます。`migenv prune` は確認してからこれらのキーだけを削除し、保護されたキーとそれ以外の内容は残します。書き換えずに確認するには `--dry-run`、CI では `--yes`、バックアップを取るには `--backup` を使ってください。

文字列を扱うときは `prune` にキーを渡します。ファイルには `pruneFile` を使います。

```ts
import { parseDirectives, prune } from 'migenv'
import { pruneFile } from 'migenv/node'

const directives = parseDirectives(templateText)
const result = prune(currentText, directives.retired, { protect: ['KEEP'] })
await pruneFile('.env', '.env.example', { backup: true })
```

`prune` は、指定したキーが重複していても、保護されていない行をすべて削除します。それ以外は、コメント、解釈できない行、BOM、改行コードも含めてそのまま残します。戻り値は `text`、`changed`、`removed`、`protectedSkips`、`warnings` です。

`pruneFile` は `migrateFile` と同じファイル情報も返し、一時ファイル経由で書き込みます。`dryRun`、`backup`、`backupDir` が使え、`strict: true` なら対象ファイルの解釈できない行をエラーにします。対象ファイルがなければ、作成せずにエラーにします。並べ替えや追加など、ほかのオプションは無視します。

どちらの指示も、`# @migenv renamed-from GOOGLE_ID`、`# @migenv retired REGISTRATION` のように `@migenv` を付けて書けます。未対応または書式が正しくない指示には、行番号付きの `invalid-directive` 警告を出します。指示の引数は表示しません。
:::

:::kiritan{locale=en}
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
:::
:::kiritan{locale=ja}
### 空の値を生成する

テンプレートの空のキーの直前に `@generate` を書きます。

```sh
# @generate base64url:32
SESSION_SECRET=

# @generate hex:32
ENCRYPTION_KEY=

# @generate uuid
INSTANCE_ID=
```

`hex` と `base64url` には、乱数のバイト数を 1〜65536 で指定できます。省略すると 32 バイトです。`base64url` は末尾の `=` を付けず、`uuid` は引数なしで UUID v4 を生成します。組み込みの生成器は直後のキーだけに適用します。`@migenv generate` とも書けます。

```sh
npx migenv fill           # 並びを変えずに、既存の空のキーを埋める
npx migenv init           # .env を作成・更新し、空の値を生成する
npx migenv align --fill   # 既存のファイルを揃え、空の値を生成する
npx migenv fill --dry-run # 書き込まずに、生成するキー名を確認する
```

通常の `align` では値を生成しません。空でない既存の値と保護されたキーはそのまま残し、再実行しても生成済みの値は変えません。`init` には `.dev.vars` などのファイルも指定でき、既存のファイルは `align` と同じ規則で更新します。`fill` はキーの追加やファイルの新規作成を行いません。どちらも `--backup`、`--dry-run`、`--protect` に対応し、出力にはキー名だけを表示します。

```ts
import { fillFile, migrateFile } from 'migenv/node'

const result = await fillFile('.env', '.env.example', { backup: true })
console.log(result.filled) // 生成したキー名だけ
await migrateFile('.dev.vars', '.dev.vars.example', { create: true, fill: true })
```

文字列には、`migenv` の `fill(text, options)` を使います。指示は文字列自体から読み取ります。`align(current, template, { fill: true })` はテンプレートの指示を使い、`reorder: false` でも生成できます。文字列APIの組み込み生成器には、グローバルな Web Crypto が必要です。Node 18 ではファイルAPIを使うか、`--experimental-global-webcrypto` を有効にするか、独自の生成器を渡してください。ファイルAPIとCLIは `node:crypto` を使うため、Node 18.3 以降で動きます。

独自の同期生成器は `options.generators` に渡します。生成器は `{ keys, arg }` を受け取り、指定されたキーすべての値をオブジェクトで返します。独自生成器の指示は、直後に並ぶキーを次のコメントか空行までまとめて扱います。鍵のペアなどを壊さないよう、一つでもキーがない、保護されている、重複している、値が入っているときは、グループ全体の生成を見送ります。設定ファイルの読み込みはまだ未対応なので、独自の生成器はライブラリAPIから渡してください。

```ts
import { fill, type Generator } from 'migenv'

const pair: Generator = () => createKeyPair() // { PUBLIC_KEY, PRIVATE_KEY } を返す
const result = fill('# @generate pair\nPUBLIC_KEY=\nPRIVATE_KEY=\n', {
  generators: { pair },
})
```

生成する値は、空でない1行の文字列にしてください。空白や `#` はクォートで囲みます。対応するクォート記号をすべて含む値や、末尾がバックスラッシュの値はエラーにします。生成器が失敗したときは、出力や元の例外を含めずに `GENERATION_FAILED` を返します。ファイルAPIは生成をすべて終えてから書き込みとバックアップを行います。
:::

:::kiritan{locale=en}
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
:::
:::kiritan{locale=ja}
## オプション

`align`、`migrateFile`、`diff` の最後の引数に渡すオプションです。すべて省略できます。

| オプション | 既定 | 意味 |
| --- | --- | --- |
| `add` | `true` | テンプレートにあって手元にないキーを、テンプレートの位置に追加する |
| `remove` | `false` | テンプレートにないキーを消す。`false` なら末尾にまとめて残す |
| `rename` | `true` | `@renamed-from` に従ってキー名を変える。新しいキーがないか、値が空のときだけ行う |
| `fill` | `false` | 並びを揃えたあと、テンプレートの `@generate` に従って空の値を生成する |
| `generators` | `{}` | 独自の同期生成器。同名の組み込み生成器より優先する |
| `protect` | `[]` | 絶対に変えないキー。`'*_SECRET'` のように `*` が使える。`(key, rawValue) => boolean` の関数も渡せる |
| `reorder` | `true` | 並びとコメントをテンプレートに合わせる。`false` なら手元の並びのまま、足すキーを末尾に付ける |
| `useTemplateDefaults` | `true` | 手元の値が空のとき、テンプレートの値を入れる |
| `extrasHeader` | `'# ---- Not in template (review manually) ----'` | テンプレートにないキーの上に付ける見出し。`false` なら付けない |
| `newline` | `'template'` | 出力の改行コード。`'template'`、`'current'`、`'lf'`、`'crlf'` から選ぶ |
| `duplicates` | `'last'` | キーが重複するとき、`'last'` は最後の値、`'first'` は最初の値を使う。`'last'` は dotenv と同じ。`'error'` はエラーにする |
| `strict` | `false` | 解釈できない行をエラーにする。`false` なら行を残して警告を出す |
| `backup` | `false` | 書き換える前に、元の内容を `<file>.bak.<日時>` に残す（ファイルAPIだけ） |
| `backupDir` | 対象と同じ場所 | バックアップを置くディレクトリ（ファイルAPIだけ） |
| `create` | `false` | 対象のファイルがなければ、テンプレートから作る（`migrateFile` だけ） |
| `dryRun` | `false` | 書き込まずに結果だけを返す（ファイルAPIだけ） |

`protect` は、ほかのすべてのオプションより優先します。対象のキーは、空でもテンプレートの値で埋めず、`remove: true` でも削除しません。保護によって見送った操作は `result.protectedSkips` と `result.warnings` に記録します。
:::

:::kiritan{locale=en}
## Errors and warnings

Errors are `MigenvError`s whose `error.code` is one of `INVALID_OPTION`, `UNKNOWN_LINE`, `DUPLICATE_KEY`, `FILE_NOT_FOUND` and `GENERATION_FAILED`. Check `error.code` rather than `instanceof`, which fails when both the ESM and the CommonJS build are loaded.

A line that cannot be parsed, such as one with an unclosed quote, is kept as it is and reported by line number in `result.warnings`. Warnings and error messages name keys and line numbers only, never values.

migenv reads quotes the way dotenv does, so a quoted value whose closing quote comes right after a backslash, such as `"C:\tools\"`, can reach into the lines after it. When aligning would make such a value read differently, `align` and `migrateFile` leave the file unchanged and add an `ambiguous-quote` warning.
:::
:::kiritan{locale=ja}
## エラーと警告

エラー時は `MigenvError` が発生します。`error.code` は `INVALID_OPTION`、`UNKNOWN_LINE`、`DUPLICATE_KEY`、`FILE_NOT_FOUND`、`GENERATION_FAILED` のいずれかです。ESM 版と CommonJS 版を同時に使うと `instanceof` で判定できないことがあるため、エラーの判定には `error.code` を使ってください。

閉じクォートのない行のように解釈できない行は、消さずにそのまま残し、`result.warnings` に行番号を出します。警告とエラーのメッセージには、キー名と行番号だけを入れ、値は入れません。

migenv はクォートを dotenv と同じ規則で解釈します。`"C:\tools\"` のように閉じクォートの直前がバックスラッシュの値は、後ろの行まで一つの値として読み取られることがあります。並べ替えで値の解釈が変わるときは、`align` も `migrateFile` もファイルを変更せず、`ambiguous-quote` の警告を出します。
:::

:::kiritan{locale=en}
## What migenv does not do

- Load environment variables. Putting them into `process.env` is the job of [dotenv](https://github.com/motdotla/dotenv), Node.js's [`--env-file`](https://nodejs.org/api/cli.html#--env-filefile) or [Wrangler](https://developers.cloudflare.com/workers/configuration/environment-variables/).
- Validate values at run time. Leave types and formats to [envalid](https://github.com/af/envalid), [zod](https://zod.dev) or [Valibot](https://valibot.dev).
- Manage or encrypt secrets. Leave that to [dotenvx](https://dotenvx.com), [1Password](https://developer.1password.com/docs/cli/secrets-environment-variables/) or [Vault](https://developer.hashicorp.com/vault).
:::
:::kiritan{locale=ja}
## やらないこと

- 環境変数の読み込み。`process.env` に入れるのは [dotenv](https://github.com/motdotla/dotenv) や Node.js の [`--env-file`](https://nodejs.org/api/cli.html#--env-filefile)、[Wrangler](https://developers.cloudflare.com/workers/configuration/environment-variables/) の役目です
- 実行時の値の検証。型や形式の検査は [envalid](https://github.com/af/envalid)、[zod](https://zod.dev)、[Valibot](https://valibot.dev) に任せます
- 秘密の管理と暗号化。[dotenvx](https://dotenvx.com) や [1Password](https://developer.1password.com/docs/cli/secrets-environment-variables/)、[Vault](https://developer.hashicorp.com/vault) に任せます
:::

:::kiritan{locale=en}
## License
:::
:::kiritan{locale=ja}
## ライセンス
:::

[MIT](./LICENSE)
