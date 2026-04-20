# Frontend Architecture Rules

This document defines the architecture boundary rules for `/Volumes/WD/Developments/nangman-note/frontend`.

## Layer Responsibilities

`/Volumes/WD/Developments/nangman-note/frontend/app`

- Owns Next.js routes, pages, and screen composition.
- May compose multiple domains.
- Must import domain code through public APIs such as `@/domains/meeting`.
- Must not import domain internals such as `@/domains/meeting/components/MeetingList`.

`/Volumes/WD/Developments/nangman-note/frontend/domains`

- Owns feature/domain behavior, UI, hooks, stores, APIs, and types.
- Each domain must expose a public API at `domains/<domain>/index.ts`.
- Domain internals may use relative imports inside the same domain.
- A domain must not import another domain directly.
- A domain must not import the `app` layer.

`/Volumes/WD/Developments/nangman-note/frontend/components`
`/Volumes/WD/Developments/nangman-note/frontend/hooks`
`/Volumes/WD/Developments/nangman-note/frontend/lib`

- Own shared UI, shared hooks, shared API clients, configuration, and low-level utilities.
- Must not import `@/domains/*`.
- Domain-specific code belongs in `domains/<domain>`.

## Automated Checks

Run:

```bash
pnpm architecture:check
```

The check fails on:

- `missing-domain-public-api`: a domain has no `index.ts`.
- `private-domain-import`: app/test/other code imports domain internals directly.
- `domain-cross-import`: one domain imports another domain.
- `shared-imports-domain`: shared code imports domain code.
- `no-app-import-outside-app`: non-app code imports the app layer.

The check warns on:

- `page-too-large`: page files over 250 lines.
- `component-too-large`: component files over 300 lines.
- `hook-too-large`: hook files over 200 lines.

Warnings are visible but do not fail the build yet. This keeps the current codebase movable while making large-file debt explicit.

## ESLint Rules

`/Volumes/WD/Developments/nangman-note/frontend/eslint.config.mjs` enforces the fast local checks:

- App/test code must use domain public APIs.
- Shared code must not import domain code.
- Domain code must not import other domains or app code.
- Nested ternaries are reported as warnings.

## Dependency-Cruiser Decision

Dependency-cruiser is not added in this first phase.

Reason:

- The current codebase needs import boundary enforcement first.
- ESLint plus `/Volumes/WD/Developments/nangman-note/frontend/scripts/check-architecture.mjs` covers the DoD without adding another dependency.
- Dependency graph reporting, circular dependency visualization, and instability metrics can be added later if the boundary rules become too broad for the custom script.

## CI Contract

CI must run the same commands developers run locally:

```bash
pnpm lint
pnpm test
pnpm build
pnpm architecture:check
```

Any UI/UX change is outside the scope of this architecture automation work and requires separate approval.
