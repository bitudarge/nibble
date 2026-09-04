import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // .claude/worktrees holds temporary git worktrees for background agents —
  // nested copies of this same repo, complete with their own tsconfig,
  // which confuses ESLint's typescript-eslint parser about which
  // tsconfigRootDir applies when more than one worktree is active at once.
  { ignores: ['dist', '.claude'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Must come last: turns off any ESLint rules that would conflict with
  // Prettier's formatting, so the two tools never fight each other.
  eslintConfigPrettier,
)
