export default {
  preset: "ts-jest",
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/src", "/canary-tests"],
  reporters: [
    "default",
    [
      "jest-stare",
      {
        resultDir: "test-results",
        reportTitle: "e2e Test Results",
      },
    ],
  ],
};
