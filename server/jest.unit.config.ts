export default {
  preset: "ts-jest",
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/integration-tests"],
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
