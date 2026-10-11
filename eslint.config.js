import js from '@eslint/js'
import globals from 'globals'
export default [
  { ignores: ['**/node_modules/**', '**/dist/**'] },
  js.configs.recommended,
  {
    files: ['server/**/*.js', 'shared/**/*.js', 'tests/**/*.js', 'scripts/**/*.js'],
    languageOptions: { globals: globals.node },
  },
]
