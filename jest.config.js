module.exports = {
  verbose: true,
  collectCoverage: !!process.env.CI || !!process.env.COVERAGE,
  collectCoverageFrom: [
    'src/**/*.ts',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '__fixtures__',
    '__mocks__',
    '__tests__',
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  coverageDirectory: './coverage',
  transformIgnorePatterns: ['/node_modules/'],
  setupFiles: ['dotenv/config'],
  testMatch: [process.env.TEST_E2E
    ? '<rootDir>/src/**/__tests__/**/*.ts'
    : '<rootDir>/src/**/__tests__/**/!(*.e2e).ts'
  ],
};
