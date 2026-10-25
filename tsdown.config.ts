import { defineConfig, type UserConfig } from 'tsdown'

// The explicit annotation is required by isolatedDeclarations
const config: UserConfig = defineConfig({
  entry: {
    'core/index': 'src/core/index.ts',
    'node/index': 'src/node/index.ts',
  },
  // Node 18 has no require(esm), so CJS consumers need their own build
  format: ['esm', 'cjs'],
  fixedExtension: true,
  target: 'node18',
  platform: 'node',
  dts: true,
  clean: true,
})

export default config
