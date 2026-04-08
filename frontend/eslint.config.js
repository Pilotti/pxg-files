const { FlatCompat } = require('@eslint/eslintrc')

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

module.exports = [
  {
    ignores: ['node_modules/**', '.next/**', 'dist/**', 'out/**'],
  },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
      'react/no-unescaped-entities': 'warn',
    },
  },
]
