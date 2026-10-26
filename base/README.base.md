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
`.env` や `.dev.vars` を、`.env.example` などのテンプレートに合わせて並べ直し、足りないキーを足します。**空でない既存の値は 1 文字も変えません。**
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
migenv に掛けると、こうなります。
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
- `PORT` は、テンプレートの値 `3000` で足されます
- 値はどれも元のままです。`APP_URL` もテンプレートの `http://localhost:3000` に戻りません
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
migenv runs on Node.js 18 and later. It ships as both ESM and CommonJS, with TypeScript type definitions for each.
:::
:::kiritan{locale=ja}
Node.js 18 以降で動きます。ESM と CommonJS の両方で配布していて、それぞれに TypeScript の型定義が付いています。
:::

:::kiritan{locale=en}
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
:::
:::kiritan{locale=ja}
## 使い方

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

書き込みは、同じディレクトリの一時ファイルに書いてから置き換えるので、途中で落ちても半端な内容は残りません。既存のファイルの権限はそのまま引き継ぎ、新しく作るファイルとバックアップは `0o600` で作ります。結果が元と同じなら、ファイルにもタイムスタンプにも触りません。
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

ファイルを使わない場面では、`migenv` の `align` に文字列を渡します。Node.js の API は使いません。

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
// { missing: ['PORT'], empty: [], extra: ['OLD_API_KEY'], orderDiffers: true }
```
:::
:::kiritan{locale=ja}
### 書き換えずに調べる

`diff` は、何も変えずに差だけを返します。CI でずれを見つけたいときに使えます。

```ts
import { diff } from 'migenv'

const report = diff(currentText, templateText)
// { missing: ['PORT'], empty: [], extra: ['OLD_API_KEY'], orderDiffers: true }
```
:::

:::kiritan{locale=en}
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
:::
:::kiritan{locale=ja}
## オプション

`align`、`migrateFile`、`diff` は、最後の引数に同じ形のオブジェクトを受け取ります。どれも省略できます。

| オプション | 既定 | 意味 |
| --- | --- | --- |
| `add` | `true` | テンプレートにあって手元にないキーを、テンプレートの位置に足す |
| `remove` | `false` | テンプレートにないキーを消す。`false` なら末尾にまとめて残す |
| `protect` | `[]` | 絶対に変えないキー。`'*_SECRET'` のように `*` が使える。`(key, rawValue) => boolean` の関数も渡せる |
| `reorder` | `true` | 並びとコメントをテンプレートに合わせる。`false` なら手元の並びのまま、足すキーを末尾に付ける |
| `useTemplateDefaults` | `true` | 手元の値が空のとき、テンプレートの値を入れる |
| `extrasHeader` | `'# ---- Not in template (review manually) ----'` | テンプレートにないキーの上に付ける見出し。`false` なら付けない |
| `newline` | `'template'` | 出力の改行コード。`'template'`、`'current'`、`'lf'`、`'crlf'` から選ぶ |
| `duplicates` | `'last'` | 同じキーが 2 回あるとき、どちらを使うか。`'last'` は dotenv と同じ。`'error'` なら例外を投げる |
| `strict` | `false` | 解釈できない行があれば例外を投げる。`false` なら行を残して警告を出す |
| `backup` | `false` | 書き換える前に、元の内容を `<file>.bak.<日時>` に残す (`migrateFile` だけ) |
| `backupDir` | 対象と同じ場所 | バックアップを置くディレクトリ (`migrateFile` だけ) |
| `create` | `false` | 対象のファイルがなければ、テンプレートから作る (`migrateFile` だけ) |
| `dryRun` | `false` | 書き込まずに結果だけを返す (`migrateFile` だけ) |

`protect` に挙げたキーは、ほかのどのオプションより優先します。空でもテンプレートの値で埋めず、`remove: true` でも消しません。止めた操作は `result.protectedSkips` と `result.warnings` に残ります。
:::

:::kiritan{locale=en}
## Errors and warnings

Errors are `MigenvError`s whose `error.code` is one of `INVALID_OPTION`, `UNKNOWN_LINE`, `DUPLICATE_KEY` and `FILE_NOT_FOUND`. Check `error.code` rather than `instanceof`, which fails when both the ESM and the CommonJS build are loaded.

A line that cannot be parsed, such as one with an unclosed quote, is kept as it is and reported by line number in `result.warnings`. Warnings and error messages name keys and line numbers only, never values.
:::
:::kiritan{locale=ja}
## エラーと警告

例外は `MigenvError` で、`error.code` に `INVALID_OPTION`、`UNKNOWN_LINE`、`DUPLICATE_KEY`、`FILE_NOT_FOUND` のどれかが入ります。ESM と CommonJS を同時に読むと `instanceof` が外れることがあるので、判定には `error.code` を使ってください。

閉じクォートのない行のように解釈できない行は、消さずにそのまま残し、`result.warnings` に行番号を出します。警告とエラーのメッセージには、キー名と行番号だけを入れ、値は入れません。
:::

:::kiritan{locale=en}
## What migenv does not do

- Load environment variables. Putting them into `process.env` is the job of dotenv, Node.js's `--env-file` or Wrangler.
- Validate values at run time. Leave types and formats to envalid or zod.
- Manage or encrypt secrets. Leave that to dotenvx, 1Password or Vault.
- Scan source code. Checking that every `process.env.X` is in `.env.example` is what dotenv-align does.
:::
:::kiritan{locale=ja}
## やらないこと

- 環境変数の読み込み。`process.env` に入れるのは dotenv や Node.js の `--env-file`、Wrangler の役目です
- 実行時の値の検証。型や形式の検査は envalid や zod に任せます
- 秘密の管理と暗号化。dotenvx や 1Password、Vault に任せます
- ソースコードの走査。`process.env.X` が `.env.example` にあるかを調べるのは dotenv-align の役目です
:::

:::kiritan{locale=en}
## License
:::
:::kiritan{locale=ja}
## ライセンス
:::

[MIT](./LICENSE)
