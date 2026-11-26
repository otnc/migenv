# migenv

[![npm](https://img.shields.io/npm/v/migenv)](https://www.npmjs.com/package/migenv)
[![CI](https://github.com/otnc/migenv/actions/workflows/ci.yml/badge.svg)](https://github.com/otnc/migenv/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/migenv)](https://www.npmjs.com/package/migenv)
[![license](https://img.shields.io/npm/l/migenv)](./LICENSE)

:::kiritan{locale=en}
Migrate `.env` and `.dev.vars` files to match their `.example` templates without changing existing values.

migenv reorders your env file to follow its template and adds the keys it is missing. **Alignment and generation never change a non-empty value, not even by one character.** Comments in the template can also rename keys, retire unused ones and generate secrets for empty ones. When the env file is ahead of the template, `extract` builds the template back from it, leaving the values out.
:::
:::kiritan{locale=ja}
`.env` や `.dev.vars` を、`.env.example` などのテンプレートの並びに揃え、足りないキーを追加します。**並べ替えや値の生成では、空でない既存の値を 1 文字も変えません。** テンプレートにコメントで指示を書けば、キー名の変更、使わなくなったキーの削除、空の値の生成もできます。env ファイルのほうに新しいキーがあるときは、`extract` で値を除いたテンプレートを作り直せます。
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
手元の `.env` は並びがばらばらで、`PORT` がなく、もう使わない `OLD_API_KEY` が残っています。
:::

```sh
DATABASE_URL=postgres://localhost/app
SESSION_SECRET=s3cr3t
APP_URL=https://dev.example.com
OLD_API_KEY=abc123
SENTRY_DSN=https://key@sentry.io/1
```

:::kiritan{locale=en}
After `npx migenv`:
:::
:::kiritan{locale=ja}
`npx migenv` で揃えると、次のようになります。
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
- `OLD_API_KEY` is not in the template, so it is collected at the end instead of being deleted. Pass `--remove` (`remove: true`) to delete it.
:::
:::kiritan{locale=ja}
- 並びとコメントはテンプレートと同じになります
- 足りなかった `PORT` を、テンプレートの値 `3000` で追加します
- 既存の値はそのままです。`APP_URL` もテンプレートの `http://localhost:3000` には戻りません
- テンプレートでコメントアウトされた `# SENTRY_DSN=` は省略できるキーとして扱います。手元に値があれば、その位置に入ります
- テンプレートにない `OLD_API_KEY` は、消さずに末尾へまとめます。消すには `--remove` (`remove: true`) を指定します
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
Node.js 18.3 以降で動きます。API は ESM と CommonJS の両方で使え、それぞれに TypeScript の型定義が付いています。
:::

:::kiritan{locale=en}
## Commands

```sh
npx migenv                 # align .env with .env.example (same as "migenv align")
npx migenv check           # exit with 1 when .env is out of date, for CI
npx migenv diff            # show what align would change
npx migenv init            # create or align .env, then generate empty values
npx migenv prune --backup  # remove @retired keys after confirmation
npx migenv extract -k PORT # create or update .env.example from .env, keeping only PORT's value
npx migenv align .env.local --remove --protect SESSION_SECRET --backup
```

| Command | What it does |
| --- | --- |
| `align` | Reorder each file to follow its template and add the keys it is missing. This is the default command |
| `check` | Exit with 1 when a file is out of date. Nothing is written |
| `diff` | Show what `align` would change. Nothing is written |
| `init` | Create or align each file, then generate empty values with `@generate` |
| `fill` | Generate empty values with `@generate`, without adding keys or reordering |
| `prune` | Remove the keys listed by `@retired`, after confirmation |
| `extract` | Create or update each template from its env file, leaving the values out |

Each file uses `<file>.example` as its template. If that is missing, migenv drops the file's last suffix and tries again: `.env.local` falls back to `.env.example`. Choose a template with `-t, --template <path>`. Paths are relative to the directory you run migenv in. Files given without a command, as in `npx migenv .env.local --create`, are aligned; a file named like a command needs it spelled out, as in `npx migenv align check`.

CLI flags correspond to the [options](#options). Use `npx migenv <command> --help` for each command's flags. `-p, --protect <keys>` and `-k, --keep-values <keys>` accept comma-separated keys or repeated flags. `--remove` and `prune` ask before deleting keys; pass `--yes` in CI. `check` and `diff` never write, and no command prints values.

| Exit code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | `check` found a file out of date |
| 2 | Usage error, missing file or template, or parse failure |

Messages are in English or Japanese, chosen by `--lang <en|ja>`, then `LC_ALL`, `LC_MESSAGES` and `LANG`.
:::
:::kiritan{locale=ja}
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
:::

:::kiritan{locale=en}
## Template directives

Comments in the template tell migenv about renamed keys, retired keys and values to generate. Each directive also accepts the `@migenv` prefix, as in `# @migenv renamed-from GOOGLE_ID`. Malformed or unsupported directives produce `invalid-directive` warnings with line numbers; their arguments are never shown.

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

`hex` and unpadded `base64url` accept a byte length from 1 to 65536 (default 32). `uuid` produces a UUID v4 and takes no argument. Built-ins apply only to the next key.

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
:::

:::kiritan{locale=en}
## Build a template from an env file

`extract` works in the other direction: it builds the template from your env file. When you add a key to `.env`, `npx migenv extract` adds it to `.env.example` too.

```ts
import { extract } from 'migenv'
import { extractFile } from 'migenv/node'

extract('# Server\nPORT=3000\nAPI_KEY=sk-live-1\n# OLD_KEY=sk-old\n', undefined, {
  keepValues: ['PORT'],
}).text
// => '# Server\nPORT=3000\nAPI_KEY=\n'

await extractFile('.env', '.env.example', { keepValues: ['PORT', 'NODE_ENV'] })
```

Values are left empty unless `keepValues` (`-k, --keep-values`) names the key. Inline comments and lines that cannot be parsed are left out, because they can hold parts of a value. Other comments and blank lines are copied.

Commented-out entries such as `# OLD_KEY=sk-old` often hold real values, so they are left out by default and listed in `result.droppedCommentedEntries`. Set `commentedEntries: 'empty'` (`--commented-entries empty`) to write them as `# OLD_KEY=`, which templates use for optional keys, or `'keep'` to copy them as they are.

When the template already exists, its lines are never changed. Each key it lacks is inserted after the key that comes before it in the env file, together with the comment lines directly above it; a key with no known key before it goes at the end. Keys the template lists in `@retired` or `@renamed-from` are not added back. `remove: true` deletes template entries that the env file does not have, except protected ones, and the CLI asks before deleting.

The CLI writes to `<file>.example`, or to the first existing template found as described under [Commands](#commands), or to `--template`. A new template is created with mode `0o644`; the env file is only read. `extractFile` supports `backup`, `backupDir` and `dryRun`, and returns `added`, `removed`, `keptValues`, `droppedCommentedEntries`, `written` and `created`.
:::
:::kiritan{locale=ja}
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
:::

:::kiritan{locale=en}
## Library

The CLI is built on these functions. `migenv` works on strings and uses no Node.js API; `migenv/node` reads and writes files.

| Function | Entry | What it does |
| --- | --- | --- |
| `align` / `migrateFile` | `migenv` / `migenv/node` | Align with the template, as `migenv align` does |
| `diff` | `migenv` | Report what `align` would change |
| `setValues` | `migenv` | Overwrite selected values on purpose |
| `prune` / `pruneFile` | `migenv` / `migenv/node` | Remove `@retired` keys |
| `fill` / `fillFile` | `migenv` / `migenv/node` | Generate empty values |
| `extract` / `extractFile` | `migenv` / `migenv/node` | Build a template from an env file |
| `writeFileAtomic` | `migenv/node` | Replace a file without leaving it half written |

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

When there is no file to work on, pass strings to `align` from `migenv`.

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
:::
:::kiritan{locale=ja}
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
:::

:::kiritan{locale=en}
## Options

Functions that take options take the same options object as their last argument and ignore the options they do not use. Every option is optional.

| Option | Default | Meaning |
| --- | --- | --- |
| `add` | `true` | Add keys that the template has and your file lacks, at the template's position |
| `remove` | `false` | Delete keys that the template does not have. When `false`, they are kept at the end. `extract` deletes template keys that the env file does not have |
| `rename` | `true` | Move values from keys named by `@renamed-from` when the destination is missing or empty |
| `fill` | `false` | Generate empty values after alignment using the template's `@generate` directives |
| `generators` | `{}` | Custom synchronous generators, overriding built-ins with the same name |
| `protect` | `[]` | Keys that are never changed. `*` matches anything, as in `'*_SECRET'`. A `(key, rawValue) => boolean` function also works |
| `keepValues` | `[]` | `extract` only: keys whose values are copied into the template, in the same form as `protect` |
| `commentedEntries` | `'remove'` | `extract` only: commented-out entries such as `# KEY=value` are left out (`'remove'`), written as `# KEY=` (`'empty'`) or copied as they are (`'keep'`) |
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
:::

:::kiritan{locale=en}
## Errors and warnings

Errors are `MigenvError`s whose `error.code` is one of `INVALID_OPTION`, `INVALID_VALUE`, `UNKNOWN_LINE`, `DUPLICATE_KEY`, `FILE_NOT_FOUND` and `GENERATION_FAILED`. Check `error.code` rather than `instanceof`, which fails when both the ESM and the CommonJS build are loaded.

A line that cannot be parsed, such as one with an unclosed quote, is kept as it is and reported by line number in `result.warnings`. Warnings and error messages name keys and line numbers only, never values.

migenv reads quotes the way dotenv does, so a quoted value whose closing quote comes right after a backslash, such as `"C:\tools\"`, can reach into the lines after it. When aligning would make such a value read differently, `align` and `migrateFile` leave the file unchanged and add an `ambiguous-quote` warning.
:::
:::kiritan{locale=ja}
## エラーと警告

エラーは `MigenvError` で、`error.code` は `INVALID_OPTION`、`INVALID_VALUE`、`UNKNOWN_LINE`、`DUPLICATE_KEY`、`FILE_NOT_FOUND`、`GENERATION_FAILED` のどれかです。ESM 版と CommonJS 版を両方読み込むと `instanceof` では判定できないので、`error.code` で判定してください。

閉じクォートのない行のように解釈できない行は消さずにそのまま残し、行番号を `result.warnings` に入れます。警告とエラーのメッセージにはキー名と行番号だけを入れ、値は入れません。

migenv はクォートを dotenv と同じ規則で読みます。そのため `"C:\tools\"` のように閉じクォートの直前がバックスラッシュの値は、後ろの行まで一つの値として読まれることがあります。揃えるとこうした値の読み方が変わるときは、`align` も `migrateFile` もファイルを変えずに `ambiguous-quote` の警告を出します。
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
