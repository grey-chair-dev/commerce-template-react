module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'tests/**/*.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup-mocks.js'],
  testTimeout: 5000, // Reduced from 30s - mocks are fast
  // Suppress import.meta warnings in Jest (expected in CommonJS environment)
  // The code works fine in production/Vercel where ES modules are supported
  globals: {
    'import.meta': {},
  },
};
