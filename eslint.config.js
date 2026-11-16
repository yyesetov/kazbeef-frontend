import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // .claude и .agents — сторонние скиллы агента, не код приложения
  { ignores: ['dist', 'coverage', 'node_modules', '.claude', '.agents'] },
  js.configs.recommended,
  // Правила с учётом типов: ловят необработанные промисы и утечки any
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // Файл с компонентами экспортирует только компоненты, иначе горячая замена в разработке сбрасывает состояние
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      // any допустим только осознанно и с объяснением
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      // В обработчиках событий (onClick={async () => ...}) возвращаемый промис никто не ждёт — это нормально
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },
  {
    // Файлы конфигурации не входят в tsconfig и проверяются без типов
    files: ['*.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  // Форматирование — дело Prettier: отключаем правила ESLint, которые с ним спорят
  prettier,
);
