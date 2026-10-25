// Biome handles formatting and general linting. ESLint is here only for eslint-plugin-n,
// which reads "engines" and rejects Node APIs and built-ins that Node 18 does not have.
import n from 'eslint-plugin-n'
import tseslint from 'typescript-eslint'

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: { n },
    rules: {
      'n/no-unsupported-features/node-builtins': 'error',
      'n/no-unsupported-features/es-builtins': 'error',
      'n/no-unsupported-features/es-syntax': 'error',
    },
  },
]
