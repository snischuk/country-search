# Country Search

## Project structure

The project is organized by feature. The architecture example has been removed;
the current entry point displays Hello, world!. The structure below describes
the intended organization as real functionality is developed with tests.

```text
src/
├── app/                         # application startup and composition
├── features/
│   ├── country-search/          # country search feature
│   │   ├── domain/              # country model and business rules
│   │   ├── application/         # search use case and workflow
│   │   ├── infrastructure/      # countries.dev API and adapter
│   │   ├── presentation/        # input, interactions, and rendering
│   │   └── index.ts             # feature's public entry point
│   └── search-history/          # recent-search history feature
│       ├── domain/
│       ├── application/
│       ├── infrastructure/
│       ├── presentation/
│       └── index.ts             # its public entry point
├── services/
│   └── search-history/          # shared history capability
│       ├── domain/              # five unique recent queries
│       ├── application/         # operations and storage contract
│       ├── infrastructure/      # localStorage and JSON adapter
│       └── index.ts             # service public API
└── shared/
    └── utils/format-number.ts   # generic number formatter
```

Keep the four responsibilities inside the feature that owns them. Domain rules
stay independent of the UI and network. Application coordinates the use case;
infrastructure talks to external systems; presentation handles the UI. The
`app` folder connects the pieces. A feature's `index.ts` is its public API, so
other features do not reach into its internal folders. `services` is for a
business capability used by multiple features; the API client stays inside its
feature's infrastructure. `shared` is for generic helpers such as number
formatting. Add layers only when they have a real responsibility.

The same responsibility boundaries apply inside **features and services**.
`services` indicates reuse across features; it does not combine business rules
with storage or UI. `shared` contains generic technical code and no product
business rules. Technical modules in `shared` also keep pure logic separate from
side effects when both are present.

For history, Domain handles trimming, exact case-sensitive duplicates, order,
and the ten-query limit. Application accepts a `SearchHistoryStorage` contract, coordinates
recording/reading, and notifies subscribers. Infrastructure implements storage
and JSON handling. The composition root in `app/app.ts` will create one service instance and supply
it to both features. A matching in-memory adapter replaces localStorage without changing the rules
or UI. An asynchronous IndexedDB or API adapter also requires an explicitly
asynchronous port and lifecycle. Storage errors currently
leave history available in memory for the current session.

ESLint checks layer direction inside features, services, and structured shared
modules, plus public entry points for features and services. It cannot decide
whether a function contains a business rule; that responsibility still requires
code review. Do not bypass a layer boundary by importing its module's `index.ts`.
