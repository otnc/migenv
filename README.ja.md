# migenv

[English](README.md) | **日本語**

[![npm](https://img.shields.io/npm/v/migenv)](https://www.npmjs.com/package/migenv)
[![CI](https://github.com/otnc/migenv/actions/workflows/ci.yml/badge.svg)](https://github.com/otnc/migenv/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/migenv)](https://www.npmjs.com/package/migenv)
[![license](https://img.shields.io/npm/l/migenv)](./LICENSE)

`.env` や `.dev.vars` を、`.env.example` などのテンプレートの並びに揃え、足りないキーを追加します。**並べ替えや値の生成では、空でない既存の値を 1 文字も変えません。** テンプレートにコメントで指示を書けば、キー名の変更、使わなくなったキーの削除、空の値の生成もできます。env ファイルのほうに新しいキーがあるときは、`extract` で値を除いたテンプレートを作り直せます。

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

手元の `.env` は並びがばらばらで、`PORT` がなく、もう使わない `OLD_API_KEY` が残っています。

```sh
DATABASE_URL=postgres://localhost/app
SESSION_SECRET=s3cr3t
APP_URL=https://dev.example.com
OLD_API_KEY=abc123
SENTRY_DSN=https://key@sentry.io/1
```

`npx migenv` で揃えると、次のようになります。

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

- 並びとコメントはテンプレートと同じになります
- 足りなかった `PORT` を、テンプレートの値 `3000` で追加します
- 既存の値はそのままです。`APP_URL` もテンプレートの `http://localhost:3000` には戻りません
- テンプレートでコメントアウトされた `# SENTRY_DSN=` は省略できるキーとして扱います。手元に値があれば、その位置に入ります
- テンプレートにない `OLD_API_KEY` は、消さずに末尾へまとめます。消すには `--remove` (`remove: true`) を指定します

## インストール

```sh
npm install --save-dev migenv
```

Node.js 18.3 以降で動きます。API は ESM と CommonJS の両方で使え、それぞれに TypeScript の型定義が付いています。

## コマンド

```sh
npx migenv                 # .env を .env.example に揃える ("migenv align" と同じ)
npx migenv check           # .env がずれていれば exit 1 で終える。CI 用
npx migenv diff            # align で何が変わるかを表示する
npx migenv init            # .env を作成・更新し、空の値を生成する
npx migenv prune --backup  # @retired のキーを、確認してから消す
npx migenv extract -k PORT # .env から .env.example を作成・更新する。値を残すのは PORT だけ
npx migenv align .env.local --remove --protect SESSION_SECRET --backup
```

| コマンド | すること |
| --- | --- |
| `align` | 並びをテンプレートに合わせ、足りないキーを足す。既定のコマンド |
| `check` | ずれているファイルがあれば exit 1 で終える。何も書き換えない |
| `diff` | `align` で何が変わるかを表示する。何も書き換えない |
| `init` | ファイルを作成・更新し、`@generate` に従って空の値を生成する |
| `fill` | `@generate` に従って空の値を生成する。キーの追加や並べ替えはしない |
| `prune` | `@retired` にあるキーを、確認してから消す |
| `extract` | env ファイルからテンプレートを作成・更新する。値は入れない |

テンプレートには `<ファイル>.example` を使います。見つからなければファイル名の最後の拡張子を外して探すので、`.env.local` には `.env.example` を使えます。別のテンプレートを使うには `-t, --template <パス>` を指定します。パスは migenv を実行したディレクトリからの相対パスです。`npx migenv .env.local --create` のようにコマンドを付けずにファイルを渡すと align します。コマンドと同じ名前のファイルを渡すときは、`npx migenv align check` のように align を明示してください。

CLI のフラグは[オプション](#オプション)に対応しています。コマンドごとのフラグは `npx migenv <コマンド> --help` で確認できます。`-p, --protect <キー>` と `-k, --keep-values <キー>` は、カンマ区切りでもフラグの繰り返しでも指定できます。`--remove` と `prune` は削除の前に確認するので、CI では `--yes` を付けてください。`check` と `diff` は何も書き換えません。どのコマンドも値は表示しません。

| 終了コード | 意味 |
| --- | --- |
| 0 | 成功 |
| 1 | `check` でテンプレートとのずれを検出 |
| 2 | 引数が不正、ファイルやテンプレートがない、解析に失敗 |

表示言語は英語か日本語で、`--lang <en|ja>`、`LC_ALL`、`LC_MESSAGES`、`LANG` の順に見て決めます。

## テンプレートに書く指示

テンプレートのコメントで、キー名の変更、使わなくなったキー、生成する値を migenv に伝えられます。どの指示も `# @migenv renamed-from GOOGLE_ID` のように `@migenv` を付けて書けます。未対応の指示や書式が正しくない指示には、行番号付きの `invalid-directive` 警告を出します。指示の引数は表示しません。

### キー名の変更

テンプレートのキーの直前に、変更前の名前を `@renamed-from` で書きます。キーはコメントアウトせずに書いてください。

```sh
# @renamed-from GOOGLE_ID
GOOGLE_CLIENT_ID=
```

新しいキーがないか値が空なら `align` は古いキーの値を新しい名前に移し、古い名前を消します。クォート、`=` の前後の空白、行末コメントもそのまま残ります。`result.renamed` には変更前後の名前が `{ from, to }` の形で入ります。名前の変更を止めるには `rename: false` か `--no-rename` を指定します。`add: false` では止まりません。

変更前か変更後のキーが `protect` の対象なら、名前を変えません。次のときは `rename-conflict` の警告を出します。新しいキーにすでに値があるとき、古いキーがテンプレートにコメントアウトされずに残っているとき、変更の指定が連鎖・循環しているとき、一つのキーに複数の新しい名前を指定したときです。テンプレートにない古いキーは既定では残り、`remove: true` なら削除の対象になります。

### 使わなくなったキーの削除

使わなくなったキーを、テンプレートのどこかに `@retired` で書きます。複数あるときは空白で区切ります。

```sh
# @retired REGISTRATION INVITES_PER_USER
```

これらのキーが残っていると `align` は警告し、`diff(...).retired` でも一覧を取れます。`migenv prune` は確認してから、これらのキーだけを削除します。保護されたキーとそれ以外の内容は残します。書き換えずに確認するには `--dry-run`、CI では `--yes`、元のファイルを残すには `--backup` を使ってください。

文字列なら `prune` にキーを渡し、ファイルなら `pruneFile` を使います。

```ts
import { parseDirectives, prune } from 'migenv'
import { pruneFile } from 'migenv/node'

const directives = parseDirectives(templateText)
const result = prune(currentText, directives.retired, { protect: ['KEEP'] })
await pruneFile('.env', '.env.example', { backup: true })
```

`prune` は指定したキーが重複していても、保護されていない行をすべて削除します。それ以外はコメント、解釈できない行、BOM、改行コードも含めてそのまま残します。戻り値は `text`、`changed`、`removed`、`protectedSkips`、`warnings` です。

`pruneFile` は `migrateFile` と同じファイル情報も返し、一時ファイル経由で書き込みます。`dryRun`、`backup`、`backupDir` が使え、`strict: true` なら対象ファイルの解釈できない行をエラーにします。対象ファイルがなければ作らずにエラーにします。並べ替えや追加など、ほかのオプションは無視します。

### 空の値の生成

テンプレートの空のキーの直前に `@generate` を書きます。

```sh
# @generate base64url:32
SESSION_SECRET=

# @generate hex:32
ENCRYPTION_KEY=

# @generate uuid
INSTANCE_ID=
```

`hex` と `base64url` には乱数のバイト数を 1〜65536 で指定できます。省略すると 32 バイトです。`base64url` は末尾の `=` を付けません。`uuid` は引数を取らず、UUID v4 を生成します。組み込みの生成器は直後のキーだけに使います。

```sh
npx migenv fill           # 並びを変えずに、既存の空のキーを埋める
npx migenv init           # .env を作成・更新し、空の値を生成する
npx migenv align --fill   # 既存のファイルを揃え、空の値を生成する
npx migenv fill --dry-run # 書き込まずに、生成するキー名を確認する
```

通常の `align` は値を生成しません。空でない既存の値と保護されたキーはそのまま残り、再実行しても生成済みの値は変わりません。`init` には `.dev.vars` などのファイルも指定でき、既存のファイルは `align` と同じ規則で更新します。`fill` はキーを追加せず、ファイルがなければ作りません。どちらのコマンドも `--backup`、`--dry-run`、`--protect` に対応し、キー名だけを表示します。

```ts
import { fillFile, migrateFile } from 'migenv/node'

const result = await fillFile('.env', '.env.example', { backup: true })
console.log(result.filled) // 生成したキー名だけ
await migrateFile('.dev.vars', '.dev.vars.example', { create: true, fill: true })
```

文字列には `migenv` の `fill(text, options)` を使います。指示は文字列そのものから読み取ります。`align(current, template, { fill: true })` はテンプレートの指示を使い、`reorder: false` でも生成します。文字列 API の組み込み生成器には、グローバルな Web Crypto が必要です。Node 18 では、ファイル API を使うか、`--experimental-global-webcrypto` を有効にするか、独自の生成器を渡してください。ファイル API と CLI は `node:crypto` を使うので、Node 18.3 以降で動きます。

独自の同期生成器は `options.generators` に渡します。生成器は `{ keys, arg }` を受け取り、渡されたキーすべての値をオブジェクトで返します。独自の生成器の指示は、直後に続くキーを次のコメントか空行までまとめて扱います。鍵のペアなどを壊さないよう、キーが一つでも欠けている、保護されている、重複している、値が入っているときは、グループ全体の生成を見送ります。設定ファイルの読み込みはまだ実装していないので、独自の生成器はライブラリ API から渡してください。

```ts
import { fill, type Generator } from 'migenv'

const pair: Generator = () => createKeyPair() // { PUBLIC_KEY, PRIVATE_KEY } を返す
const result = fill('# @generate pair\nPUBLIC_KEY=\nPRIVATE_KEY=\n', {
  generators: { pair },
})
```

生成する値は空でない 1 行の文字列にしてください。空白や `#` を含む値はクォートで囲みます。対応するクォート記号をすべて含む値や、末尾がバックスラッシュの値はエラーにします。生成器が失敗したときは、生成した値や元の例外を含めずに `GENERATION_FAILED` を投げます。ファイル API は、生成をすべて終えてから書き込みとバックアップを行います。

## env ファイルからテンプレートを作る

`extract` は逆向きに、env ファイルからテンプレートを作ります。`.env` にキーを足したら、`npx migenv extract` で `.env.example` にも足せます。

```ts
import { extract } from 'migenv'
import { extractFile } from 'migenv/node'

extract('# Server\nPORT=3000\nAPI_KEY=sk-live-1\n# OLD_KEY=sk-old\n', undefined, {
  keepValues: ['PORT'],
}).text
// => '# Server\nPORT=3000\nAPI_KEY=\n'

await extractFile('.env', '.env.example', { keepValues: ['PORT', 'NODE_ENV'] })
```

値は空にします。値を残すキーは `keepValues` (`-k, --keep-values`) で指定します。行末コメントと解釈できない行は、値の一部が入っていることがあるので入れません。それ以外のコメントと空行はコピーします。

`# OLD_KEY=sk-old` のようにコメントアウトされた行には、本物の値が残っていることがよくあります。そのため既定では入れずに、キー名を `result.droppedCommentedEntries` に記録します。`commentedEntries: 'empty'` (`--commented-entries empty`) を指定すると、省略できるキーを示す書き方の `# OLD_KEY=` として入れます。`'keep'` ならそのまま入れます。

テンプレートがすでにあるときは、その行を一切変えません。テンプレートにないキーは、env ファイルでその直前にあるキーの後ろに、すぐ上のコメント行と一緒に入れます。直前にテンプレートのキーがなければ末尾に入れます。テンプレートの `@retired` や `@renamed-from` にあるキーは足し戻しません。`remove: true` を指定すると、env ファイルにないテンプレートのキーを消します。保護されたキーは消さず、CLI は消す前に確認します。

CLI はふだん `<ファイル>.example` に書き込みます。[コマンド](#コマンド)で説明した順に探して既存のテンプレートが見つかればそれに書き込み、`--template` を指定すればそこに書き込みます。新しいテンプレートは `0o644` で作り、env ファイルは読むだけです。`extractFile` は `backup`、`backupDir`、`dryRun` に対応し、`added`、`removed`、`keptValues`、`droppedCommentedEntries`、`written`、`created` を返します。

## ライブラリ

CLI は次の関数でできています。`migenv` は文字列だけを扱い、Node.js の API を使いません。`migenv/node` はファイルを読み書きします。

| 関数 | 読み込み元 | すること |
| --- | --- | --- |
| `align` / `migrateFile` | `migenv` / `migenv/node` | `migenv align` と同じように、テンプレートに揃える |
| `diff` | `migenv` | `align` で何が変わるかを返す |
| `setValues` | `migenv` | 指定した値を上書きする |
| `prune` / `pruneFile` | `migenv` / `migenv/node` | `@retired` のキーを消す |
| `fill` / `fillFile` | `migenv` / `migenv/node` | 空の値を生成する |
| `extract` / `extractFile` | `migenv` / `migenv/node` | env ファイルからテンプレートを作る |
| `writeFileAtomic` | `migenv/node` | 書きかけの状態を残さずにファイルを置き換える |

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

同じディレクトリの一時ファイルに書いてから元のファイルと置き換えるので、書き込みが途中で止まっても書きかけの内容は残りません。既存のファイルは権限を引き継ぎ、新しいファイルとバックアップは `0o600` で作ります。内容が変わらなければ、ファイルもタイムスタンプも更新しません。

### 文字列のまま揃える

ファイルを使わないときは、`migenv` の `align` に文字列を渡します。

```ts
import { align } from 'migenv'

const result = align(currentText, templateText, { remove: true })
result.text // 揃えた内容
result.changed // 元と違えば true
```

### 書き換えずに調べる

`diff` は足りないキーや並びの違いを返し、何も変えません。CI での確認に使えます。

```ts
import { diff } from 'migenv'

const report = diff(currentText, templateText)
// { missing: ['PORT'], empty: [], extra: ['OLD_API_KEY'], retired: [], orderDiffers: true }
```

### 指定した値を上書きする

`setValues` は指定したキーの値を、空でない値も含めて上書きします。`ReadonlyMap<string, string>` には、クォートや行末コメントも含めて `=` より後ろの文字列を渡します。値のデコードや自動エスケープはしません。たとえば `new Map([['LABEL', '"hello # world"']])` を渡すと、`LABEL="hello # world"` と書き込みます。

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

指定していない行やコメント、BOM、混在した改行コード、末尾の改行の有無は保ちます。書き換える行も `export` と `=` より前の空白は残し、`=` より後ろだけをすべて置き換えます。足りないキーは元のファイルの改行コードで末尾に追加し、空のファイルでは LF を使います。解釈できない行があれば、その最初の行の前に追加します。既存のキーだけを更新するには `add: false` を指定してください。

同じキーが複数の行にあるときは、後ろの行の値が更新を打ち消さないよう、すべての行を更新します。`duplicates: 'first'` と `'last'` はどちらも重複した行を残して更新し、`'error'` は重複をエラーにします。`protect` に当たる行が一つでもあれば、そのキーの更新はすべて見送ります。保護されたキーは新しく追加もしません。`strict: true` なら解釈できない行をエラーにし、指定しなければ行を残して警告します。並べ替えやファイル操作など、ほかのオプションは無視します。

クォートで囲んだ複数行の値も渡せます。キー名が不正なとき、クォートが閉じていないとき、値に別のキーの行が混ざっているときは、値をメッセージに含めずに `INVALID_VALUE` を投げます。前後のクォートの影響で値の読み方が変わるときは、元の文字列と `ambiguous-quote` の警告を返し、指定したキーをすべて `skipped` に入れます。同じ値をもう一度設定しても内容は変わりません。ファイルやリモートを更新するときは、返された文字列を既存の書き込み処理に渡してください。`migenv/node` の `writeFileAtomic` も使えます。

## オプション

オプションを取る関数は最後の引数に同じ形のオプションを受け取り、使わないオプションは無視します。すべて省略できます。

| オプション | 既定 | 意味 |
| --- | --- | --- |
| `add` | `true` | テンプレートにあって手元にないキーを、テンプレートの位置に追加する |
| `remove` | `false` | テンプレートにないキーを消す。`false` なら末尾にまとめて残す。`extract` では env ファイルにないテンプレートのキーを消す |
| `rename` | `true` | `@renamed-from` に従ってキー名を変える。新しいキーがないか、値が空のときだけ変える |
| `fill` | `false` | 並びを揃えたあと、テンプレートの `@generate` に従って空の値を生成する |
| `generators` | `{}` | 独自の同期生成器。同じ名前の組み込み生成器より優先する |
| `protect` | `[]` | 絶対に変えないキー。`'*_SECRET'` のように `*` が使える。`(key, rawValue) => boolean` の関数も渡せる |
| `keepValues` | `[]` | `extract` だけ: 値をテンプレートにコピーするキー。指定のしかたは `protect` と同じ |
| `commentedEntries` | `'remove'` | `extract` だけ: `# KEY=value` のようにコメントアウトされた行を、入れない (`'remove'`)、`# KEY=` として入れる (`'empty'`)、そのまま入れる (`'keep'`) |
| `reorder` | `true` | 並びとコメントをテンプレートに合わせる。`false` なら手元の並びのまま、足すキーを末尾に付ける |
| `useTemplateDefaults` | `true` | 手元の値が空のとき、テンプレートの値を入れる |
| `extrasHeader` | `'# ---- Not in template (review manually) ----'` | テンプレートにないキーの上に付ける見出し。`false` なら付けない |
| `newline` | `'template'` | 出力の改行コード。`'template'`、`'current'`、`'lf'`、`'crlf'` から選ぶ |
| `duplicates` | `'last'` | キーが重複するとき、`'last'` は最後の値を、`'first'` は最初の値を使う。`'last'` は dotenv と同じ。`'error'` はエラーにする |
| `strict` | `false` | 解釈できない行をエラーにする。`false` なら行を残して警告を出す |
| `backup` | `false` | 書き換える前に、元の内容を `<ファイル>.bak.<日時>` に残す (ファイル API だけ) |
| `backupDir` | 対象と同じ場所 | バックアップを置くディレクトリ (ファイル API だけ) |
| `create` | `false` | 対象のファイルがなければ、テンプレートから作る (`migrateFile` だけ) |
| `dryRun` | `false` | 書き込まずに結果だけを返す (ファイル API だけ) |

`protect` はほかのどのオプションよりも優先します。保護されたキーは空でもテンプレートの値で埋めず、`remove: true` でも削除しません。保護のために見送った操作は `result.protectedSkips` と `result.warnings` に記録します。

## エラーと警告

エラーは `MigenvError` で、`error.code` は `INVALID_OPTION`、`INVALID_VALUE`、`UNKNOWN_LINE`、`DUPLICATE_KEY`、`FILE_NOT_FOUND`、`GENERATION_FAILED` のどれかです。ESM 版と CommonJS 版を両方読み込むと `instanceof` では判定できないので、`error.code` で判定してください。

閉じクォートのない行のように解釈できない行は消さずにそのまま残し、行番号を `result.warnings` に入れます。警告とエラーのメッセージにはキー名と行番号だけを入れ、値は入れません。

migenv はクォートを dotenv と同じ規則で読みます。そのため `"C:\tools\"` のように閉じクォートの直前がバックスラッシュの値は、後ろの行まで一つの値として読まれることがあります。揃えるとこうした値の読み方が変わるときは、`align` も `migrateFile` もファイルを変えずに `ambiguous-quote` の警告を出します。

## やらないこと

- 環境変数の読み込み。`process.env` に入れるのは [dotenv](https://github.com/motdotla/dotenv) や Node.js の [`--env-file`](https://nodejs.org/api/cli.html#--env-filefile)、[Wrangler](https://developers.cloudflare.com/workers/configuration/environment-variables/) の役目です
- 実行時の値の検証。型や形式の検査は [envalid](https://github.com/af/envalid)、[zod](https://zod.dev)、[Valibot](https://valibot.dev) に任せます
- 秘密の管理と暗号化。[dotenvx](https://dotenvx.com) や [1Password](https://developer.1password.com/docs/cli/secrets-environment-variables/)、[Vault](https://developer.hashicorp.com/vault) に任せます

## ライセンス

[MIT](./LICENSE)
