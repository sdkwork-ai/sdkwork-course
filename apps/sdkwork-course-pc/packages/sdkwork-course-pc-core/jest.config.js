export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  // The package ships compiled `.js` siblings next to its `.ts` sources; the
  // sources are authoritative, so resolve `.ts` first or Jest imports stale JS.
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '\\.node-test\\.ts$'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: { module: 'ESNext' } }],
  },
}
