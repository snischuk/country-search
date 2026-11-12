import boundaries from 'eslint-plugin-boundaries';
import { recommended } from 'eslint-plugin-boundaries/config';

const layers = ['domain', 'application', 'infrastructure', 'presentation'];
const moduleKinds = ['feature', 'service', 'shared'];
const moduleFolders = {
  feature: 'features',
  service: 'services',
  shared: 'shared',
};
const getModuleTypes = kind => [
  kind,
  ...layers.map(layer => `${kind}-${layer}`),
];
const getLayerTypes = layer => moduleKinds.map(kind => `${kind}-${layer}`);
const protectedTypes = [
  ...getModuleTypes('feature'),
  ...getModuleTypes('service'),
];
const facades = [...moduleKinds, 'app'];

export default {
  files: ['src/**/*.ts', 'tests/**/*.ts'],
  plugins: { boundaries },
  settings: {
    ...recommended.settings,
    'boundaries/root-path': import.meta.dirname,
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app' },
      ...moduleKinds.flatMap(kind => [
        ...layers.map(layer => ({
          type: `${kind}-${layer}`,
          pattern: `src/${moduleFolders[kind]}/*/${layer}`,
          capture: ['moduleName'],
        })),
        {
          type: kind,
          pattern: `src/${moduleFolders[kind]}/*`,
          capture: ['moduleName'],
        },
      ]),
    ],
    'boundaries/files': [
      { pattern: 'src/main.ts', category: 'composition-root' },
      { pattern: 'src/**/*.css', category: 'style' },
      { pattern: 'src/assets/**/*', category: 'asset' },
      { pattern: 'tests/**/*.test.ts', category: 'test' },
    ],
    'import/resolver': {
      typescript: { alwaysTryTypes: true, project: './tsconfig.json' },
    },
  },
  rules: {
    ...recommended.rules,
    'boundaries/dependencies': [
      'error',
      {
        default: 'allow',
        policies: [
          // Consumers enter features and services through their public API.
          { disallow: { to: { element: { type: protectedTypes } } } },
          {
            allow: {
              to: {
                element: {
                  type: ['feature', 'service'],
                  fileInternalPath: 'index.ts',
                },
              },
            },
          },
          // Internal imports stay within the owning module.
          ...moduleKinds.map(kind => ({
            from: { element: { type: getModuleTypes(kind) } },
            allow: {
              to: {
                element: {
                  type: getModuleTypes(kind),
                  captured: {
                    moduleName: '{{ from.element.captured.moduleName }}',
                  },
                },
              },
            },
          })),
          // A layer cannot bypass its boundaries through its own module facade.
          ...moduleKinds.map(kind => ({
            from: {
              element: { type: layers.map(layer => `${kind}-${layer}`) },
            },
            disallow: {
              to: {
                element: {
                  type: kind,
                  captured: {
                    moduleName: '{{ from.element.captured.moduleName }}',
                  },
                },
              },
            },
          })),
          // Apply the same responsibility boundaries in every kind of module.
          {
            from: { element: { type: getLayerTypes('domain') } },
            disallow: {
              to: {
                element: {
                  type: [
                    ...facades,
                    ...getLayerTypes('application'),
                    ...getLayerTypes('infrastructure'),
                    ...getLayerTypes('presentation'),
                  ],
                },
              },
            },
          },
          {
            from: { element: { type: getLayerTypes('application') } },
            disallow: {
              to: {
                element: {
                  type: [
                    ...facades,
                    ...getLayerTypes('infrastructure'),
                    ...getLayerTypes('presentation'),
                  ],
                },
              },
            },
          },
          {
            from: { element: { type: getLayerTypes('infrastructure') } },
            disallow: {
              to: { element: { type: getLayerTypes('presentation') } },
            },
          },
          {
            from: { element: { type: getLayerTypes('presentation') } },
            disallow: {
              to: { element: { type: getLayerTypes('infrastructure') } },
            },
          },
          {
            from: { element: { type: getModuleTypes('service') } },
            disallow: {
              to: { element: { type: [...getModuleTypes('feature'), 'app'] } },
            },
          },
          {
            from: { element: { type: getModuleTypes('feature') } },
            disallow: { to: { element: { type: 'app' } } },
          },
          {
            from: { element: { type: getModuleTypes('shared') } },
            disallow: { to: { element: { type: [...protectedTypes, 'app'] } } },
          },
          {
            from: { file: { categories: 'test' } },
            allow: { to: { element: { type: protectedTypes } } },
          },
          { disallow: { to: { file: { categories: 'test' } } } },
        ],
      },
    ],
  },
};
