import { defineConfig, type ViteUserConfig } from 'vitest/config'

// The explicit annotation is required by isolatedDeclarations
const config: ViteUserConfig = defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      include: ['src/**/*.ts'],
    },
  },
})

export default config
