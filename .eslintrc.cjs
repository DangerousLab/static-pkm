module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    '.eslintrc.cjs',
    'javascript/**/*',
    'Home/**/*',
    'vendor/**/*',
    'scripts/**/*',
    'tailwind.config.js',
    'postcss.config.js',
    'rollup.config.js',
    'rollup.config.css.js',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['react-refresh', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // TypeScript strict rules
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_' },
    ],
    // No class components
    'react/prefer-stateless-function': 'off', // Handled by functional components guideline
    // Console logging (allowed with format)
    'no-console': 'off',
    // Async patterns
    'no-restricted-globals': [
      'error',
      {
        name: 'setTimeout',
        message: 'Use React hooks or async/await instead of setTimeout for logic flow.',
      },
      {
        name: 'setInterval',
        message: 'Use React hooks or async/await instead of setInterval for logic flow.',
      },
    ],
  },
};
