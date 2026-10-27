# migenv

[English](README.md) | **日本語**

[![npm](https://img.shields.io/npm/v/migenv)](https://www.npmjs.com/package/migenv)
[![CI](https://github.com/otnc/migenv/actions/workflows/ci.yml/badge.svg)](https://github.com/otnc/migenv/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/migenv)](https://www.npmjs.com/package/migenv)
[![license](https://img.shields.io/npm/l/migenv)](./LICENSE)

`.env` や `.dev.vars` の並びを、`.env.example` などのテンプレートに揃え、不足しているキーを追加します。**並べ替えや値の生成では、空でない既存の値は 1 文字も変えません。** 指定した値を明示的に上書きするには `setValues` を使います。

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

migenv で揃えると、こうなります。

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
- 不足していた `PORT` を、テンプレートの値 `3000` で追加します
- 既存の値はそのままです。`APP_URL` もテンプレートの `http://localhost:3000` に戻りません
- テンプレートでコメントアウトされた `# SENTRY_DSN=` は、任意のキーとして扱います。手元に値があれば、その位置に入ります
- テンプレートにない `OLD_API_KEY` は、消さずに末尾へまとめます。消したいときは `remove: true` を渡します

## インストール

```sh
npm install --save-dev migenv
```

Node.js 18.3 以降で動きます。API は ESM と CommonJS に対応し、TypeScript の型定義も付属します。

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

### 文字列のまま揃える

`migenv` の `align` に文字列を渡すと、ファイルを読み書きせずに揃えられます。Node.js の API は使いません。

```ts
import { align } from 'migenv'

const result = align(currentText, templateText, { remove: true })
result.text // 揃えた内容
result.changed // 元と違えば true
```

### 指定した値を上書きする

`setValues` は、指定したキーの値を、空でない値も含めて上書きします。`ReadonlyMap<string, string>` には、クォートや行末コメントも含めた `=` より後ろの文字列を渡します。値のデコードや自動エスケープは行いません。たとえば `new Map([['LABEL', '"hello # world"']])` を渡すと、`LABEL="hello # world"` と書き込みます。

```ts
import { setValues } from 'migenv'

const result = setValues(currentText, new Map([
  ['ORIGIN', 'https://example.com'],
  ['LABEL', '"hello # world"'],
]), { protect: ['SESSION_SECRET'] })

result.text    // 更新後の内容
result.updated // 既存の値を書き換えたキー
result.added   // Map の順で追加したキー
result.skipped // 保護されたキーと、add: false で追加を見送ったキー
```

指定していない行やコメント、BOM、混在した改行コード、末尾の改行の有無は保ちます。書き換える行も、`export` や `=` より前の空白は残し、`=` より後ろだけをすべて置き換えます。足りないキーは、元のファイルの改行コードで末尾に追加します。空のファイルでは LF を使います。解釈できない行があれば、その最初の行の前に追加します。既存のキーだけを更新するには `add: false` を指定してください。

同じキーが複数の行にあるときは、後ろの行の値が更新を打ち消さないよう、すべての行を更新します。`duplicates: 'first'` と `'last'` はどちらも重複した行を残して更新し、`'error'` なら重複をエラーにします。一つでも `protect` の対象になる行があれば、そのキーの更新はすべて見送ります。保護されたキーは新規追加もしません。`strict: true` なら解釈できない行をエラーにし、通常は行を残して警告します。並べ替えやファイル操作など、ほかのオプションは無視します。

クォートで囲んだ複数行の値も渡せます。キー名が不正、クォートが閉じていない、値に別のキーの行が混ざっているときは、値をメッセージに含めずに `INVALID_VALUE` を返します。前後のクォートの影響で値の読み方が変わるときは、元の文字列と `ambiguous-quote` の警告を返し、指定したキーをすべて `skipped` に入れます。同じ値を再び設定しても内容は変わりません。ファイルやリモートの更新には、返された文字列を既存の書き込み処理に渡してください。`migenv/node` の `writeFileAtomic` も使えます。

### 書き換えずに調べる

`diff` は、不足しているキーや並びの違いを返します。CI での確認などに使えます。

```ts
import { diff } from 'migenv'

const report = diff(currentText, templateText)
// { missing: ['PORT'], empty: [], extra: ['OLD_API_KEY'], retired: [], orderDiffers: true }
```

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

## エラーと警告

エラー時は `MigenvError` が発生します。`error.code` は `INVALID_OPTION`、`INVALID_VALUE`、`UNKNOWN_LINE`、`DUPLICATE_KEY`、`FILE_NOT_FOUND`、`GENERATION_FAILED` のいずれかです。ESM 版と CommonJS 版を同時に使うと `instanceof` で判定できないことがあるため、エラーの判定には `error.code` を使ってください。

閉じクォートのない行のように解釈できない行は、消さずにそのまま残し、`result.warnings` に行番号を出します。警告とエラーのメッセージには、キー名と行番号だけを入れ、値は入れません。

migenv はクォートを dotenv と同じ規則で解釈します。`"C:\tools\"` のように閉じクォートの直前がバックスラッシュの値は、後ろの行まで一つの値として読み取られることがあります。並べ替えで値の解釈が変わるときは、`align` も `migrateFile` もファイルを変更せず、`ambiguous-quote` の警告を出します。

## やらないこと

- 環境変数の読み込み。`process.env` に入れるのは [dotenv](https://github.com/motdotla/dotenv) や Node.js の [`--env-file`](https://nodejs.org/api/cli.html#--env-filefile)、[Wrangler](https://developers.cloudflare.com/workers/configuration/environment-variables/) の役目です
- 実行時の値の検証。型や形式の検査は [envalid](https://github.com/af/envalid)、[zod](https://zod.dev)、[Valibot](https://valibot.dev) に任せます
- 秘密の管理と暗号化。[dotenvx](https://dotenvx.com) や [1Password](https://developer.1password.com/docs/cli/secrets-environment-variables/)、[Vault](https://developer.hashicorp.com/vault) に任せます

## ライセンス

[MIT](./LICENSE)
