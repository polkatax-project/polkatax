export default {
  preset: "ts-jest",
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/e2e-tests",
    "/canary-tests",
  ],
  reporters: [
    "default",
    [
      "jest-stare",
      {
        resultDir: "test-results",
        reportTitle: "Unit test Results",
      },
    ],
  ],
};
