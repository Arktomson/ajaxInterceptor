module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'bilingual-commit': [2, 'always'],
  },
  plugins: [
    {
      rules: {
        'bilingual-commit': (parsed) => {
          const enforceTypes = ['feat', 'fix', 'refactor', 'perf'];
          const { type, subject } = parsed;

          if (!type || !enforceTypes.includes(type)) {
            return [true];
          }

          if (!subject || !subject.includes('|')) {
            return [
              false,
              `The commit message for "${type}" must include both Chinese and English separating by "|" (e.g. "feat: 新增拦截 | Add interception")`,
            ];
          }

          const parts = subject.split('|').map((s) => s.trim());
          if (parts.length < 2 || !parts[0] || !parts[1]) {
            return [
              false,
              `Both sides of "|" must have content. (e.g. "feat: 新增拦截 | Add interception")`,
            ];
          }

          return [true];
        },
      },
    },
  ],
};
