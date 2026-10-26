/** `FILE_NOT_FOUND` comes from `migrateFile`; the others from every function that takes options. */
export type MigenvErrorCode = 'UNKNOWN_LINE' | 'DUPLICATE_KEY' | 'INVALID_OPTION' | 'FILE_NOT_FOUND'

/**
 * The error migenv throws. Messages name keys and line numbers but never values.
 *
 * Check `error.code` rather than `instanceof MigenvError`: the ESM and CJS builds each define their own class, so `instanceof` fails when both are loaded.
 *
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
