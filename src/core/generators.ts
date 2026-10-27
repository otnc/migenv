import { MigenvError } from './errors'

/** The consecutive keys following `@generate`, and its optional argument. */
export interface GeneratorContext {
  readonly keys: readonly string[]
  readonly arg?: string | undefined
}

/**
 * Produces a value for every requested key. Values must be non-empty, single-line strings that can be quoted in an env file. A group is generated only when all its keys are empty and unprotected.
 * @example
 * const pair: Generator = ({ keys }) => Object.fromEntries(keys.map((key) => [key, 'generated']))
 */
export type Generator = (context: GeneratorContext) => Readonly<Record<string, string>>

/** Builds the same encodings with the host's cryptographically secure random source. */
export const createGenerators = (
  randomBytes: (size: number) => Uint8Array,
): Readonly<Record<'hex' | 'base64url' | 'uuid', Generator>> => {
  const sizeFor = (arg: string | undefined): number => {
    if (arg === undefined) return 32
    if (!/^[1-9][0-9]*$/.test(arg) || Number(arg) > 65536)
      throw new MigenvError(
        'GENERATION_FAILED',
        'Generator byte length must be between 1 and 65536.',
      )
    return Number(arg)
  }
  const hex = (bytes: Uint8Array): string =>
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return {
    hex: ({ keys, arg }) => {
      const size = sizeFor(arg)
      return Object.fromEntries(keys.map((key) => [key, hex(randomBytes(size))]))
    },
    base64url: ({ keys, arg }) => {
      const size = sizeFor(arg)
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
      return Object.fromEntries(
        keys.map((key) => {
          const bytes = randomBytes(size)
          const encoded: string[] = []
          for (let index = 0; index < bytes.length; index += 3) {
            const a = bytes[index] as number
            const b = bytes[index + 1]
            const c = bytes[index + 2]
            encoded.push(alphabet[a >> 2] as string)
            encoded.push(alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)] as string)
            if (b !== undefined) encoded.push(alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)] as string)
            if (c !== undefined) encoded.push(alphabet[c & 63] as string)
          }
          return [key, encoded.join('')]
        }),
      )
    },
    uuid: ({ keys, arg }) => {
      if (arg !== undefined)
        throw new MigenvError('GENERATION_FAILED', 'The uuid generator takes no argument.')
      return Object.fromEntries(
        keys.map((key) => {
          const bytes = randomBytes(16)
          bytes[6] = ((bytes[6] as number) & 15) | 64
          bytes[8] = ((bytes[8] as number) & 63) | 128
          const value = hex(bytes)
          return [
            key,
            `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`,
          ]
        }),
      )
    },
  }
}

/**
 * Cryptographic `hex` and unpadded `base64url` generators (32 bytes by default), and UUID v4. Requires global Web Crypto; file APIs supply Node's random source instead.
 * @example
 * generators.hex({ keys: ['TOKEN'], arg: '32' }) // => { TOKEN: '<64 hex characters>' }
 */
export const generators: Readonly<Record<'hex' | 'base64url' | 'uuid', Generator>> =
  // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Web Crypto is supplied by the host; Node file APIs inject node:crypto instead.
  createGenerators((size) => globalThis.crypto.getRandomValues(new Uint8Array(size)))
