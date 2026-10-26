# migenv

[English](README.md) | **日本語**

[![npm](https://img.shields.io/npm/v/migenv)](https://www.npmjs.com/package/migenv)
[![CI](https://github.com/otnc/migenv/actions/workflows/ci.yml/badge.svg)](https://github.com/otnc/migenv/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/migenv)](https://www.npmjs.com/package/migenv)
[![license](https://img.shields.io/npm/l/migenv)](./LICENSE)

`.env` や `.dev.vars` を、`.env.example` などのテンプレートに合わせて並べ直し、足りないキーを足します。**空でない既存の値は 1 文字も変えません。**

## 何をするか

テンプレートの `.env.example` が次のようになっているとします。

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

手元の `.env` は、並びがばらばらで、`PORT` がなく、もう使わない `OLD_API_KEY` が残っています。

```sh
DATABASE_URL=postgres://localhost/app
SESSION_SECRET=s3cr3t
APP_URL=https://dev.example.com
OLD_API_KEY=abc123
SENTRY_DSN=https://key@sentry.io/1
```

migenv に掛けると、こうなります。

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

- 並びとコメントは、テンプレートと同じになります
- `PORT` は、テンプレートの値 `3000` で足されます
- 値はどれも元のままです。`APP_URL` もテンプレートの `http://localhost:3000` に戻りません
- テンプレートでコメントアウトされた `# SENTRY_DSN=` は、任意のキーとして扱います。手元に値があれば、その位置に入ります
- テンプレートにない `OLD_API_KEY` は、消さずに末尾へまとめます。消したいときは `remove: true` を渡します

## インストール

```sh
npm install --save-dev migenv
```

Node.js 18.3 以降で動きます。API は ESM と CommonJS の両方で配布していて、それぞれに TypeScript の型定義が付いています。

## 使い方

### コマンドライン

```sh
npx migenv              # .env を .env.example に揃える ("migenv align" と同じ)
npx migenv check        # .env がずれていれば exit 1 で終える。CI 用
npx migenv diff         # align で何が変わるかを表示する
npx migenv align .env.local --remove --protect SESSION_SECRET --backup
```

各ファイルは `<ファイル>.example` に揃えます。それがなければ、ファイル名の最後の拡張子を外して探し直すので、`.env.local` は `.env.example` を使います。テンプレートを自分で決めるときは `-t, --template <パス>` を渡します。パスは migenv を実行したディレクトリが基準です。`check` と `diff` は何も書き換えず、どのコマンドも値を表示しません。

フラグは下のオプションに対応しています。`--no-add`、`--remove`、`-p, --protect <キー>` (カンマ区切りか、繰り返して指定)、`--no-reorder`、`--no-template-defaults`、`--newline <template|current|lf|crlf>`、`--duplicates <last|first|error>`、`--strict` と、`align` だけで使える `--backup`、`--backup-dir <ディレクトリ>`、`--create`、`--dry-run` です。`--remove` はキーを消す前に確認します。CI のように答えられない場面では `--yes` を付けてください。

終了コードは、成功なら 0、`check` でずれが見つかれば 1、使い方の誤り、ファイルやテンプレートがない、解釈に失敗したときは 2 です。表示は英語か日本語で、`--lang <en|ja>`、`LC_ALL`、`LC_MESSAGES`、`LANG` の順に見て決めます。

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

### 文字列のまま揃える

ファイルを使わない場面では、`migenv` の `align` に文字列を渡します。Node.js の API は使いません。

```ts
import { align } from 'migenv'

const result = align(currentText, templateText, { remove: true })
result.text // 揃えた内容
result.changed // 元と違えば true
```

### 書き換えずに調べる

`diff` は、何も変えずに差だけを返します。CI でずれを見つけたいときに使えます。

```ts
import { diff } from 'migenv'

const report = diff(currentText, templateText)
// { missing: ['PORT'], empty: [], extra: ['OLD_API_KEY'], orderDiffers: true }
```

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

## エラーと警告

例外は `MigenvError` で、`error.code` に `INVALID_OPTION`、`UNKNOWN_LINE`、`DUPLICATE_KEY`、`FILE_NOT_FOUND` のどれかが入ります。ESM と CommonJS を同時に読むと `instanceof` が外れることがあるので、判定には `error.code` を使ってください。

閉じクォートのない行のように解釈できない行は、消さずにそのまま残し、`result.warnings` に行番号を出します。警告とエラーのメッセージには、キー名と行番号だけを入れ、値は入れません。

migenv はクォートを dotenv と同じように読みます。そのため、`"C:\tools\"` のように閉じクォートの直前がバックスラッシュの値は、後ろの行まで続けて読まれることがあります。揃えるとこうした値の読み方が変わってしまうときは、`align` も `migrateFile` もファイルを変えずに、`ambiguous-quote` の警告を出します。

## やらないこと

- 環境変数の読み込み。`process.env` に入れるのは [dotenv](https://github.com/motdotla/dotenv) や Node.js の [`--env-file`](https://nodejs.org/api/cli.html#--env-filefile)、[Wrangler](https://developers.cloudflare.com/workers/configuration/environment-variables/) の役目です
- 実行時の値の検証。型や形式の検査は [envalid](https://github.com/af/envalid)、[zod](https://zod.dev)、[Valibot](https://valibot.dev) に任せます
- 秘密の管理と暗号化。[dotenvx](https://dotenvx.com) や [1Password](https://developer.1password.com/docs/cli/secrets-environment-variables/)、[Vault](https://developer.hashicorp.com/vault) に任せます

## ライセンス

[MIT](./LICENSE)
