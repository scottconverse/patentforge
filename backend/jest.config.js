module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // Allow ts-jest to transform ESM packages (marked, docx)
  transformIgnorePatterns: [
    'node_modules/(?!(marked|docx)/)',
  ],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      lines: 42,
      branches: 37,
      functions: 31,
      statements: 43,
    },
  },
};
