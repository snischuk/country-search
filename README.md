# Country Search

## Project structure

The project is organized by feature. `src/main.ts` loads the styles and starts
the country search UI. The composition root in `src/app/app.ts` connects the
feature panel, search controller, HTTP adapter, and browser scheduler through
the feature's public API. `app/pages` owns page layout and composes feature UI. The tree below shows the intended structure as further functionality
is implemented.

```text
src/
├── app/
│   ├── app.ts                  # dependency wiring and startup
│   └── pages/
│       └── country-search.page.{ts,css}  # page layout composed from feature UI
├── features/country-search/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   ├── presentation/
│   │   ├── country-search-panel/  # *.component.ts + *.component.css
│   │   ├── country-card/
│   │   ├── country-details/
│   │   ├── search-form/
│   │   ├── search-feedback/
│   │   └── country-search.utility.ts
│   └── index.ts
└── shared/presentation/ui-kit/
    ├── button/button.component.{ts,css}
    ├── input/input.component.{ts,css}
    ├── modal/modal.component.{ts,css}
    └── index.ts
```

Keep the four responsibilities inside the feature that owns them. Domain rules
stay independent of the UI and network. Application coordinates the use case;
infrastructure talks to external systems; presentation handles the UI. The
`app` folder connects the pieces. A feature's `index.ts` is its public API, so
other features do not reach into its internal folders. `services` is for a
cohesive business capability used by multiple features; the API client stays
inside its feature's infrastructure. Generic buttons, inputs, and native modal
behavior live in `shared/presentation/ui-kit`; they know nothing about countries
or search states. Feature components assemble these primitives using Country and
SearchState. Each component owns its TS and CSS; `src/style.css` holds theme tokens
and global resets. Page layout belongs in `app/pages`.

A `*.component.ts` file contains one component factory; its matching
`*.component.css` owns its styles. Child markup stays in its owning component. Cohesive formatters, display values
and message builders are grouped in the feature's `country-search.utility.ts`.

The same responsibility boundaries apply inside **features, services, and shared**.
`services` indicates reuse across features; it does not combine business rules
with storage or UI. Shared modules follow the same layer
boundaries: pure logic, runtime integrations, and UI behavior belong to the
layers that own those responsibilities.

For history, Domain handles trimming, exact case-sensitive duplicates, order,
and the ten-query limit. Application accepts a `SearchHistoryStorage` contract, coordinates
recording/reading, and notifies subscribers. Infrastructure implements storage
and JSON handling. The composition root in `app/app.ts` will create one service instance and supply
it to both features. A matching in-memory adapter replaces localStorage without changing the rules
or UI. An asynchronous IndexedDB or API adapter also requires an explicitly
asynchronous port and lifecycle. Storage errors currently
leave history available in memory for the current session.

ESLint checks layer direction inside features, services, and structured modules,
plus public entry points for features and services. It cannot decide
whether a function contains a business rule; that responsibility still requires
code review. Do not bypass a layer boundary by importing its module's `index.ts`.
