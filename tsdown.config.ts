import { defineConfig, type UserConfig } from 'tsdown'

const shared = {
  fixedExtension: true,
  target: 'node18',
  platform: 'node',
} as const satisfies UserConfig

const config: UserConfig[] = defineConfig([
  {
    ...shared,
    entry: {
      'core/index': 'src/core/index.ts',
      'node/index': 'src/node/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
  },
  {
    ...shared,
    // citty is ESM only, and the CLI is never imported, so it ships as ESM alone.
    entry: { 'cli/index': 'src/cli/bin.ts' },
    format: ['esm'],
    dts: false,
    clean: false,
  },
])

export default config
