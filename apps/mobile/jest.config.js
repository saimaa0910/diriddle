const jestExpoPreset = require('jest-expo/jest-preset');

const setupFiles = (jestExpoPreset.setupFiles || []).flatMap((file) =>
  file.includes('jest-expo') && file.includes('setup.js')
    ? ['<rootDir>/src/__tests__/pre-setup.js', file]
    : [file]
);

module.exports = {
  ...jestExpoPreset,
  setupFiles,
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testMatch: ['<rootDir>/src/__tests__/**/*.test.{ts,tsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:(jest-)?react-native|@react-native(?:-community)?|expo(?:nent)?|@expo(?:nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|zustand|@diriddle/shared-types))',
  ],
  moduleNameMapper: {
    '^react-native-vector-icons$': '@expo/vector-icons',
    '^react-native-vector-icons/(.*)': '@expo/vector-icons/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
