/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jest-environment-node",
  testPathIgnorePatterns: ["/node_modules/"],
  globalSetup: "./test/setup.ts",
  globalTeardown: "./test/teardown.ts",
};
