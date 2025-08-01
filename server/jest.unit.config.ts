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
      "jest-json-reporter",
      {
        outputPath: "test-results/unit-test-results.json",
      },
    ],
  ],
};
