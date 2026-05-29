# Changelog

## 0.4.0 — 2026-05-29

### Changed
- Upgraded the package's Zod dependency to v4.
- Bumped `@opencall/types` dependency to `^0.2.0`.

## 0.3.0 — 2026-05-18

### Added
- `opencall-generate-server-registry` CLI: scans operation source files, reads their JSDoc `@op` annotations, and emits a pre-imported `operations.generated.ts` module for edge/Workers builds that cannot use `buildRegistry()` at runtime.
- `--check` flag on the same CLI: generates the expected output in memory and exits 1 if the file on disk is missing or out of sync. Designed for CI drift detection — add it as a lint step so edited `@op` annotations that weren't regenerated are caught before merge.
- JSDoc warning on `ModuleEntry.meta`: clarifies that this field should always be populated by `opencall-generate-server-registry`, not written by hand.

### Docs
- README restructured with a "Core principle" section and two distinct workflow sections: Node/Bun (runtime `buildRegistry`) vs. edge runtimes (build-time `opencall-generate-server-registry` + `buildRegistryFromModules`).
- CLI table updated to include both commands.

## 0.2.2 — 2026-05-01

### Changed
- `buildRegistry()` and `buildRegistryFromModules()` now emit the current structured OpenCALL registry response, including `schemaHash`, service-level `endpoints`, optional `errorsUrl`, and structured per-operation `sync`, `idempotency`, `cache`, `telemetry`, and `stream` blocks.
- Server tests now import the local workspace sources directly so CI does not depend on Bun creating workspace package links before `bun test`.

### Docs
- Updated test fixtures and metadata examples to reflect the current registry contract.

## 0.2.1 — 2026-04-27

### Added
- `formatResponse` now maps `OperationResult.state === "streaming"` to a 202 response with `state: "streaming"` and the `stream` field populated on the response envelope. Throws if a streaming result is missing its `stream` descriptor.

### Changed
- Bumped `@opencall/types` peer dep from `^0.1.0` to `^0.1.2` (picks up the relaxed `ctx.requestId` schema and the streaming `OperationResult` shape).

### Docs
- README banner and `homepage` now point at `https://opencall-api.com` (the human-readable docs landing). The `/spec` path is reserved for raw markdown that AI agents fetch directly.

## 0.2.0 — 2026-04-27

First public release on npm. Extracted from the previously-private `@opencall/ts-tools` codebase, retargeted onto `@opencall/types` for canonical schemas.

### Added
- `BackendUnavailableError` is re-exported from `@opencall/types`.
- `isDbConnectionError(err)` heuristic for postgres connection failures.
- `safeHandlerCall` now returns HTTP 503 with `BACKEND_UNAVAILABLE` for `BackendUnavailableError` throws and for errors recognised by `isDbConnectionError`.
- `OperationModule.requiresAuth` field is honored.
- All `@opencall/types` exports are re-exported (consumers can import envelope types from this package directly).

### Changed
- Imports from `./envelope`, `./errors`, `./types` are now `from "@opencall/types"`.
- Package renamed from the unpublished `@opencall/ts-tools` to `@opencall/server`.

## 0.1.0 — 2026-02-20 (private; never published)

Original local release as `@opencall/ts-tools`.
