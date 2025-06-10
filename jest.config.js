module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  globals: {
    'ts-jest': { useESM: true },
  },
};
