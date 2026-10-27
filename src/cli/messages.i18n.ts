const messages = {
  'command.fill': {
    en: 'Generate empty values using @generate rules in the template.',
    ja: 'テンプレートの @generate に従って、空の値を生成します。',
  },
  'command.init': {
    en: 'Create or align env files from their templates and generate empty values.',
    ja: 'テンプレートから env ファイルを作成・更新し、空の値を生成します。',
  },
  'arg.fill': {
    en: 'Generate empty values after alignment',
    ja: '並びを揃えたあと、空の値を生成する',
  },
  'report.filled': { en: 'generated', ja: '生成' },
  'report.protectedFill': {
    en: 'protected, generation skipped',
    ja: 'protect されているので、値を生成しなかった',
  },
  'warning.generationConflict': {
    en: '%{file}: generation group skipped because keys are missing, duplicated or already initialized (line %{line})',
    ja: '%{file}: キーの不足・重複、または既存の値があるため、グループの生成を見送りました（%{line} 行目）',
  },
  'error.generationFailed': {
    en: '%{file}: could not generate values. %{detail}',
    ja: '%{file}: 値を生成できませんでした。%{detail}',
  },
  'command.prune': {
    en: 'Remove keys listed by @retired in the template after confirmation.',
    ja: 'テンプレートの @retired にあるキーを、確認してから消します。',
  },
  'arg.rename': {
    en: 'Move values from keys named by @renamed-from',
    ja: '@renamed-from の古いキーから値を移す',
  },
  'arg.rename.negative': { en: 'Do not rename keys', ja: 'キーを改名しない' },
  'report.renamed': { en: 'renamed', ja: '改名' },
  'report.protectedRename': {
    en: 'protected, rename skipped',
    ja: 'protect されているので、改名しなかった',
  },
  'warning.invalidDirective': {
    en: '%{file}: unsupported or malformed directive (line %{line})',
    ja: '%{file}: 未対応または書式が正しくないディレクティブがあります（%{line} 行目）',
  },
  'warning.renameConflict': {
    en: '%{file}: %{key} could not be renamed because the names conflict',
    ja: '%{file}: 改名先に値があるか名前が競合するため、%{key} を改名しませんでした',
  },
  'warning.retiredKey': {
    en: '%{file}: %{key} is retired. Run "migenv prune" to remove it.',
    ja: '%{file}: %{key} は使われなくなったキーです。"migenv prune" で削除できます。',
  },
  'command.main': {
    en: 'Migrate .env files to match their .example templates without changing existing values.',
    ja: '既存の値を変えずに、.env をテンプレートの .example に合わせて移行します。',
  },
  'command.align': {
    en: 'Reorder each file to follow its template and add the keys it is missing. This is the default command.',
    ja: '並びをテンプレートに合わせ、足りないキーを足します。既定のコマンドです。',
  },
  'command.check': {
    en: 'Exit with 1 when a file is out of date. Nothing is written.',
    ja: 'ずれているファイルがあれば exit 1 で終えます。何も書き換えません。',
  },
  'command.diff': {
    en: 'Show what align would change. Nothing is written, and values are never shown.',
    ja: 'align で何が変わるかを表示します。何も書き換えず、値も表示しません。',
  },

  'arg.files': {
    en: 'Env files to work on. Defaults to .env',
    ja: '対象の env ファイル。省略すると .env',
  },
  'arg.template': {
    en: 'Template to use for every file. Defaults to <file>.example',
    ja: 'すべてのファイルに使うテンプレート。省略すると <ファイル>.example',
  },
  'arg.lang': {
    en: 'Language of the output: en or ja. Defaults to LC_ALL, LC_MESSAGES or LANG',
    ja: '表示の言語。en か ja。省略すると LC_ALL、LC_MESSAGES、LANG から決める',
  },
  'arg.yes': {
    en: 'Remove keys with --remove or prune without asking',
    ja: '--remove または prune でキーを消すとき、確認しない',
  },
  'arg.add': {
    en: 'Add keys that the template has and the file lacks',
    ja: 'テンプレートにあってファイルにないキーを足す',
  },
  'arg.add.negative': {
    en: 'Do not add missing keys',
    ja: '足りないキーを足さない',
  },
  'arg.remove': {
    en: 'Delete keys that the template does not have',
    ja: 'テンプレートにないキーを消す',
  },
  'arg.protect': {
    en: 'Keys never to change, comma-separated or repeated. * matches anything',
    ja: '絶対に変えないキー。カンマ区切りか、繰り返して指定する。* は何にでも一致する',
  },
  'arg.reorder': {
    en: "Follow the template's order and comments",
    ja: '並びとコメントをテンプレートに合わせる',
  },
  'arg.reorder.negative': {
    en: 'Keep the current order and append added keys',
    ja: '今の並びのまま、足すキーを末尾に付ける',
  },
  'arg.templateDefaults': {
    en: "Use the template's value when the current value is empty",
    ja: '値が空のとき、テンプレートの値を入れる',
  },
  'arg.templateDefaults.negative': {
    en: 'Leave empty values empty',
    ja: '空の値は空のまま残す',
  },
  'arg.newline': {
    en: 'Line ending of the output',
    ja: '出力の改行コード',
  },
  'arg.duplicates': {
    en: 'Which value wins when a key appears twice',
    ja: '同じキーが 2 回あるとき、どちらの値を使うか',
  },
  'arg.strict': {
    en: 'Fail on lines that cannot be parsed',
    ja: '解釈できない行があれば失敗にする',
  },
  'arg.backup': {
    en: 'Save the original to <file>.bak.<timestamp> before writing',
    ja: '書き換える前に、元の内容を <ファイル>.bak.<日時> に残す',
  },
  'arg.backupDir': {
    en: 'Directory for backups',
    ja: 'バックアップを置くディレクトリ',
  },
  'arg.create': {
    en: 'Create the file from its template when it does not exist',
    ja: 'ファイルがなければ、テンプレートから作る',
  },
  'arg.dryRun': {
    en: 'Show the result without writing anything',
    ja: '書き込まずに、結果だけを表示する',
  },

  'report.added': { en: 'added', ja: '追加' },
  'report.extra': {
    en: 'not in template, kept at the end',
    ja: 'テンプレートにないので末尾に残した',
  },
  'report.removed': { en: 'removed', ja: '削除' },
  'report.protectedDefault': {
    en: 'protected, template value not applied',
    ja: 'protect されているので、テンプレートの値を入れなかった',
  },
  'report.protectedRemove': {
    en: 'protected, kept although not in template',
    ja: 'protect されているので、テンプレートになくても残した',
  },
  'report.reordered': {
    en: 'order and comments follow the template',
    ja: '並びとコメントをテンプレートに合わせた',
  },
  'report.backup': { en: 'backup: %{path}', ja: 'バックアップ: %{path}' },

  'align.updated': { en: 'Updated %{file}', ja: '%{file} を更新しました' },
  'align.created': { en: 'Created %{file}', ja: '%{file} を作りました' },
  'align.wouldUpdate': {
    en: '%{file} would be updated (dry run)',
    ja: '%{file} は更新されます (dry run)',
  },
  'align.upToDate': { en: '%{file} is up to date', ja: '%{file} は最新です' },
  'check.outOfDate': { en: '%{file} is out of date', ja: '%{file} はテンプレートとずれています' },
  'check.missing': { en: '%{file} does not exist', ja: '%{file} がありません' },
  'check.hint': {
    en: 'Run "migenv align" to update it.',
    ja: '"migenv align" で更新できます。',
  },

  'remove.confirm': {
    en: 'Remove %{keys} from %{file}?',
    ja: '%{file} から %{keys} を消しますか？',
  },
  'remove.needsYes': {
    en: '%{file}: this operation would delete %{keys}. Pass --yes to confirm when not in a terminal.',
    ja: '%{file}: この操作で %{keys} が消えます。端末でないときは --yes を付けて確定してください。',
  },
  'remove.skipped': { en: 'Skipped %{file}', ja: '%{file} は変えませんでした' },

  'warning.unknownLine.current': {
    en: '%{file}: line %{line} could not be parsed and was kept as is',
    ja: '%{file}: %{line} 行目を解釈できなかったので、そのまま残しました',
  },
  'warning.unknownLine.template': {
    en: '%{file}: line %{line} could not be parsed and was left out',
    ja: '%{file}: %{line} 行目を解釈できなかったので、出力に入れませんでした',
  },
  'warning.duplicateKey': {
    en: '%{file}: %{key} appears more than once (line %{line})',
    ja: '%{file}: %{key} が 2 回以上出てきます (%{line} 行目)',
  },
  'warning.ambiguousQuote': {
    en: '%{file}: left unchanged, because a quoted value whose closing quote follows a backslash would read differently after aligning',
    ja: '%{file}: 閉じクォートの直前がバックスラッシュの値の読み方が変わってしまうので、ファイルを変えませんでした',
  },

  'error.templateNotFound': {
    en: 'No template found for %{file}. Tried %{tried}. Pass one with --template.',
    ja: '%{file} のテンプレートが見つかりません。%{tried} を探しました。--template で指定してください。',
  },
  'error.fileNotFound': {
    en: '%{file} does not exist. Pass --create to create it from the template.',
    ja: '%{file} がありません。--create を付けると、テンプレートから作ります。',
  },
  'error.unknownLine': {
    en: '%{file}: a line could not be parsed (--strict). %{detail}',
    ja: '%{file}: 解釈できない行があります (--strict)。%{detail}',
  },
  'error.duplicateKey': {
    en: '%{file}: a key appears more than once (--duplicates error). %{detail}',
    ja: '%{file}: 同じキーが 2 回以上あります (--duplicates error)。%{detail}',
  },
  'error.invalidOption': {
    en: 'Invalid option. %{detail}',
    ja: 'オプションが正しくありません。%{detail}',
  },
  'error.usage': {
    en: '%{detail} Run "migenv --help" for usage.',
    ja: '%{detail} 使い方は "migenv --help" で見られます。',
  },
} as const

export default messages
