export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation
        'style', // Styling/formatting (no code changes)
        'refactor', // Refactoring
        'perf', // Performance improvement
        'test', // Tests
        'chore', // Maintenance/Configuration
        'ci', // CI/CD changes
        'revert', // Revert commit
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72],
  },
}
