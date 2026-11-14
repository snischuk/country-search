import { ESLint } from 'eslint';
import type { Linter } from 'eslint';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface ArchitectureCase {
  title: string;
  path: string;
  source: string;
  isDenied: boolean;
}

const root: string = fileURLToPath(new URL('../../', import.meta.url));
const moduleName: string = `architecture-probe-${process.pid}`;
const servicePath: string = `src/services/${moduleName}`;
const sharedPath: string = `src/shared/${moduleName}`;
const sharedPresentationPath: string = `src/shared/presentation/${moduleName}`;
const sharedDomainPath: string = `src/shared/domain/${moduleName}`;
const appPath: string = `src/app/${moduleName}.ts`;
const cases: ArchitectureCase[] = [
  {
    title: 'allows application to import its own domain',
    path: `${servicePath}/application/allowed.ts`,
    source: "import { value } from '../domain/value'; void value;",
    isDenied: false,
  },
  {
    title: 'rejects domain imports of storage',
    path: `${servicePath}/domain/forbidden.ts`,
    source: "import { value } from '../infrastructure/storage'; void value;",
    isDenied: true,
  },
  {
    title: 'rejects application imports of storage',
    path: `${servicePath}/application/forbidden.ts`,
    source: "import { value } from '../infrastructure/storage'; void value;",
    isDenied: true,
  },
  {
    title: 'rejects domain bypass through its own facade',
    path: `${servicePath}/domain/facade.ts`,
    source: "import { value } from '../index'; void value;",
    isDenied: true,
  },
  {
    title: 'rejects shared imports of business services',
    path: `${sharedPath}/forbidden.ts`,
    source: `import { value } from '@/services/${moduleName}/index'; void value;`,
    isDenied: true,
  },
  {
    title: 'allows presentation to use the shared UI layer',
    path: `${servicePath}/presentation/shared-ui.ts`,
    source: `import { value } from '@/shared/presentation/${moduleName}/value'; void value;`,
    isDenied: false,
  },
  {
    title: 'rejects domain imports of shared UI',
    path: `${servicePath}/domain/shared-ui.ts`,
    source: `import { value } from '@/shared/presentation/${moduleName}/value'; void value;`,
    isDenied: true,
  },
  {
    title: 'rejects shared domain imports of shared presentation',
    path: `${sharedDomainPath}/forbidden.ts`,
    source: `import { value } from '@/shared/presentation/${moduleName}/value'; void value;`,
    isDenied: true,
  },
  {
    title: 'rejects shared UI imports of business services',
    path: `${sharedPresentationPath}/forbidden.ts`,
    source: `import { value } from '@/services/${moduleName}/index'; void value;`,
    isDenied: true,
  },
  {
    title: 'allows composition through a public API',
    path: appPath,
    source: `import { value } from '@/services/${moduleName}/index'; void value;`,
    isDenied: false,
  },
  {
    title: 'rejects composition importing private storage',
    path: `src/app/${moduleName}-private.ts`,
    source: `import { value } from '@/services/${moduleName}/infrastructure/storage'; void value;`,
    isDenied: true,
  },
];
const results: Map<string, ESLint.LintResult> = new Map();

function writeFixture(path: string, source: string): void {
  const absolutePath: string = resolve(root, path);

  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

beforeAll(async (): Promise<void> => {
  writeFixture(
    `${sharedPresentationPath}/value.ts`,
    'export const value: number = 1;',
  );

  writeFixture(
    `${servicePath}/domain/value.ts`,
    'export const value: number = 1;',
  );

  writeFixture(
    `${servicePath}/infrastructure/storage.ts`,
    'export const value: number = 1;',
  );

  writeFixture(
    `${servicePath}/index.ts`,
    "export { value } from './infrastructure/storage';",
  );

  cases.forEach((testCase: ArchitectureCase): void => {
    writeFixture(testCase.path, testCase.source);
  });

  const eslint: ESLint = new ESLint({ cwd: root });
  const lintResults: ESLint.LintResult[] = await eslint.lintFiles(
    cases.map((testCase: ArchitectureCase): string =>
      resolve(root, testCase.path),
    ),
  );

  lintResults.forEach((result: ESLint.LintResult): void => {
    results.set(result.filePath, result);
  });
}, 15000);

afterAll((): void => {
  rmSync(resolve(root, servicePath), { recursive: true, force: true });
  rmSync(resolve(root, sharedPath), { recursive: true, force: true });
  rmSync(resolve(root, sharedPresentationPath), {
    recursive: true,
    force: true,
  });

  rmSync(resolve(root, sharedDomainPath), { recursive: true, force: true });
  rmSync(resolve(root, appPath), { force: true });
  rmSync(resolve(root, `src/app/${moduleName}-private.ts`), { force: true });
});

describe('architecture boundaries', (): void => {
  cases.forEach((testCase: ArchitectureCase): void => {
    it(testCase.title, (): void => {
      const result: ESLint.LintResult | undefined = results.get(
        resolve(root, testCase.path),
      );

      expect(result).toBeDefined();
      expect(result?.fatalErrorCount).toBe(0);
      expect(
        result?.messages.some(
          (message: Linter.LintMessage): boolean =>
            message.ruleId === 'boundaries/dependencies',
        ),
      ).toBe(testCase.isDenied);
    });
  });
});
