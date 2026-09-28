module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }] },
  moduleNameMapper: { "^@gym/database$": "<rootDir>/../../packages/database/src" },
};
