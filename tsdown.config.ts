import { defineConfig, type UserConfig } from 'tsdown'

const config: UserConfig = defineConfig({
  entry: {
    'core/index': 'src/core/index.ts',
    'node/index': 'src/node/index.ts',
  },
  format: ['esm', 'cjs'],
  fixedExtension: true,
  target: 'node18',
  platform: 'node',
  dts: true,
  clean: true,
})

export default config
