# Country Search

## Project structure

The project is organized by feature. `src/main.ts` loads global styles and starts
`src/app/app.ts`, the composition root. It connects concrete adapters, services,
controllers and views through their public contracts.

```text
src/
├── app/
│   ├── app.ts
│   ├── components/theme-toggle/
│   └── pages/country-search.page.{ts,css}
├── features/
│   ├── country-search/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   │   ├── http/
│   │   │   ├── scheduling/
│   │   │   └── cached-search.adapter.ts
│   │   ├── presentation/
│   │   │   ├── country-search-panel/
│   │   │   ├── country-card/
│   │   │   ├── country-details/
│   │   │   ├── search-form/
│   │   │   └── search-feedback/
│   │   └── index.ts
│   └── search-history/
│       ├── application/
│       ├── presentation/
│       └── index.ts
├── services/search-history/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── index.ts
└── shared/
    ├── application/storage/
    ├── infrastructure/
    │   ├── storage/
    │   └── theme/
    └── presentation/ui-kit/
        ├── button/
        ├── input/
        ├── modal/
        └── index.ts
```

## Dependency boundaries

The same layer responsibilities apply inside features, services and shared.
Create a layer only when the module has a responsibility that belongs there.

| Layer          | Responsibility                          | Allowed dependencies                                            |
| -------------- | --------------------------------------- | --------------------------------------------------------------- |
| Domain         | Types, business rules and invariants    | Other domain code                                               |
| Application    | Use cases and their ports               | Domain and application contracts                                |
| Infrastructure | HTTP, storage, timers and external APIs | Domain and application contracts; infrastructure helpers        |
| Presentation   | DOM, styles and user interaction        | Domain types, application contracts and presentation components |
| App            | Dependency wiring and page composition  | Public feature/service APIs and shared implementations          |

Independent features communicate through composition in `app`; one feature must
not import another, even through its `index.ts`. For example, the history panel
calls a callback supplied by `app.ts`, which delegates to the search controller.

Consumers enter features and services through their `index.ts`. Internal modules
may import their own implementation files directly with `@/...`, but cannot use
their own facade to bypass layer restrictions. Services cannot depend on features
or app code. Shared code cannot depend on features, business services or app code.

The search controller accepts `SearchPort`, `SearchView` and `SchedulerFactory`.
Cancellation and scheduling use application-owned contracts; `fetch`,
`AbortController` and browser timers remain in infrastructure. Domain and
application must not access browser globals.

`searchCountries(query, signal)` accepts a native `AbortSignal`. The composition
root supplies `createSearchCountriesAdapter()` to the controller; this adapter
translates application cancellation into a native signal and releases its
subscription when the HTTP operation finishes. `debounce(callback, delay)` uses
runtime timers by default and accepts an optional third timer driver for injection.

For history, Domain owns trimming, exact case-sensitive duplicates, ordering and
the ten-query limit. Application accepts a `HistoryStorage` port and maintains
session state. Its infrastructure adapter owns JSON, the storage key and format
version. The generic `localStorageService` only reads, writes and removes strings.
The composition root supplies one history service to both features through their
own narrow contracts. Storage failure leaves session history usable; subscriber
failure does not stop the search. Replacing the synchronous storage adapter with
IndexedDB or a remote API requires an explicitly asynchronous port and lifecycle.

Generic buttons, inputs and dialog behavior live in shared Presentation. They do
not know about countries or search state. Feature components compose them. Each
component owns its `*.component.ts` and `*.component.css`; pages own composition,
and `src/style.css` owns theme tokens and global resets. Small related display
formatters stay in `country-search.utility.ts`.

### Examples

- Allowed: `country-search/application` imports its own `domain` types.
- Allowed: an HTTP adapter implements `SearchPort` and maps external responses.
- Allowed: `app.ts` imports `@/features/country-search` and connects its controller.
- Forbidden: a domain function reads `localStorage` or calls `fetch`.
- Forbidden: a presentation component imports its infrastructure adapter.
- Forbidden: `country-search` imports `@/features/search-history` directly.
- Forbidden: a consumer imports `@/services/search-history/infrastructure/...`.

## Architecture validation

```sh
npm run check:boundaries
npm run validate
```

`check:boundaries` lints source files and runs architecture tests containing both
allowed dependencies and deliberately forbidden examples. The tests create and
remove temporary source fixtures. ESLint checks layer direction, public entry
points, feature isolation, restricted browser globals and runtime import cycles,
including paths using `@/...`. Runtime cycles are rejected even within a layer.

`validate` runs boundary checks, lint, tests, the production build (including
TypeScript checking) and formatting checks. The existing CI lint and test steps
also enforce these rules.

These checks do not determine whether code contains a business rule or belongs to
the right feature. Type-only references do not create runtime import cycles.
Browser-global restrictions cover the names listed in `eslint.config.js`; they
are not a complete detector of every platform API or indirect access pattern.
Code review remains necessary for these cases.

When changing a boundary, update `eslint.boundaries.js` or `eslint.config.js`, add
a forbidden example and an allowed control in `tests/architecture/boundaries.test.ts`,
update this description, then run `npm run validate`.

## Tests

```sh
npm test
npm run test:watch
```

Unit tests cover debounce, response mapping, HTTP errors and timeouts, cancellation,
controller state, cache sharing, history rules, storage and theme preferences.
Integration tests connect the controller to real adapters with a mocked network,
and connect search to the history service and its storage adapter.

The request race test gives the earlier request a longer response delay. Its fetch
mock rejects with `AbortError` when cancelled. It checks cancellation before the
next debounce finishes and verifies that only the latest search updates the view,
both with and without caching.

Tests use controlled responses and fake timers rather than real network calls or
timed sleeps. Small shared fixtures live in `tests/support`. Browser appearance,
keyboard interaction and native dialog behavior still require manual checks.

The commit history preserves separate failing-test and implementation commits for
debounce, response mapping, HTTP search and error classification. Later test
refactors keep these original RED → GREEN steps intact.
