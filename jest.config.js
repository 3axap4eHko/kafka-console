module.exports = {
  verbose: true,
  collectCoverage: !!process.env.TRAVIS || !!process.env.COVERAGE,
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
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.ts',
    !process.env.TRAVIS && '<rootDir>/src/**/__tests__/**/*.ts',
  ].filter(Boolean),
};
