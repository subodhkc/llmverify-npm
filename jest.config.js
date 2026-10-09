const nodeMajor = Number(process.versions.node.split('.')[0]);

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.ts'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.js'],
  // The MCP surface requires Node >= 20 (@modelcontextprotocol/server
  // engines). The CLI guards the `mcp` subcommand at runtime; here we
  // skip the suite so the Node 18 leg stays meaningful for the rest.
  ...(nodeMajor < 20 ? { testPathIgnorePatterns: ['<rootDir>/tests/mcp/'] } : {}),
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  // Sources use Node16-style `.js` specifiers that map to `.ts` files
  // (e.g. tests/mcp/** importing `../helpers/client.js`). Strip the
  // extension so jest resolves them.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.js$))'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/cli.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 90,
      statements: 90
    }
  }
};
