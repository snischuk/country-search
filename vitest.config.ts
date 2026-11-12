import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      passWithNoTests: false,
      restoreMocks: true,
      unstubGlobals: true,
    },
  }),
);
