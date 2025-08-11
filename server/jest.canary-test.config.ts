export default {
  preset: "ts-jest",
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/src", "/e2e-tests"],
  testTimeout: 1500000,
  reporters: [
    "default",
    [
      "jest-stare",
      {
        resultDir: "test-results",
        reportTitle: "Canary Test Results",
      },
    ],
  ],
};
