module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js"],
  testMatch: ["**/tests/**/*.test.(ts|js)"],
  collectCoverageFrom: [
    "src/**/*.{ts,js}",
    "!src/**/*.d.ts",
    "!src/types/**/*",
    "!src/**/index.ts"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "clover", "html"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json"
    }
  }
};
