module.exports = {
  parser: '@typescript-eslint/parser',

  // ⭐️ [추가 1] 실행 환경 설정 (Node.js 백엔드 기준)
  env: {
    node: true, // Node.js 전역 변수 사용
    es2021: true, // ES2021 문법 사용
  },

  plugins: [
    '@typescript-eslint',
    'prettier',
    'simple-import-sort', // ⭐️ [추가 2] import 정렬
  ],

  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended', // Prettier 규칙 (반드시 맨 뒤)
  ],

  rules: {
    // ⭐️ [추가 3] import 정렬 규칙 켜기
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',

    // 기본 규칙
    '@typescript-eslint/no-unused-vars': 'warn',
    'prettier/prettier': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
