export default {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  setupFiles: ["<rootDir>/tests/setup.js"],
  collectCoverageFrom: ["controllers/**/*.js", "middleware/**/*.js", "models/**/*.js"],
  coverageDirectory: "<rootDir>/coverage",
  reporters: [
    "default",
    [
      "jest-stare",
      {
        resultDir: "./coverage/jest-stare",
        reportTitle: "Hostelia 2.0 — Backend Test Report",
        reportHeadline: "API Endpoint Test Results",
        coverageLink: "../lcov-report/index.html",
      },
    ],
  ],
};
