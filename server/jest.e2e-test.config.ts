export default {
  preset: "ts-jest",
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/src", "/canary-tests"],
  reporters: [
    "default",
    [
      "jest-json-reporter",
      {
        outputPath: "test-results/e2e-test-results.json",
      },
    ],
  ],
};
