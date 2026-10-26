/** `INVALID_OPTION` can come from any function that takes options, `UNKNOWN_LINE` and `DUPLICATE_KEY` from `align` and `migrateFile`, and `FILE_NOT_FOUND` from `migrateFile`. */
export type MigenvErrorCode = 'UNKNOWN_LINE' | 'DUPLICATE_KEY' | 'INVALID_OPTION' | 'FILE_NOT_FOUND'

/**
 * The error migenv throws. Messages name keys and line numbers but never values.
 * Check `error.code` rather than `instanceof MigenvError`: the ESM and CJS builds each define their own class, so `instanceof` fails when both are loaded.
 * @example
 * try {
 *   align(current, template, { strict: true })
 * } catch (error) {
 *   if ((error as MigenvError).code === 'UNKNOWN_LINE') console.error(error.message)
 * }
 */
export class MigenvError extends Error {
  readonly code: MigenvErrorCode

  constructor(code: MigenvErrorCode, message: string) {
    super(message)
    this.name = 'MigenvError'
    this.code = code
  }
}
