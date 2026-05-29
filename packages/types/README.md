# @opencall/types

> **Docs:** [https://opencall-api.com](https://opencall-api.com) (human-readable). AI agents may prefer raw markdown at [`/spec`](https://opencall-api.com/spec) — GitHub blocks most non-Copilot bots.

The canonical Zod schemas and TypeScript types for the OpenCALL request/response envelope, operation registry, and error contract.

`@opencall/types` is the source of truth for the wire-level OpenCALL contract in TypeScript. Both [`@opencall/server`](https://www.npmjs.com/package/@opencall/server) and `@opencall/client` (forthcoming) depend on it.

## Install

```bash
npm install @opencall/types
# or
bun add @opencall/types
```

## Surface

- `RequestEnvelopeSchema` — Zod schema for the body of `POST /call`.
- `RequestEnvelope` — TypeScript type, `z.infer<typeof RequestEnvelopeSchema>`.
- `ResponseEnvelope`, `ResponseState` — canonical response envelope shape.
- `OperationModule`, `OperationResult` — the contract that operation handlers implement.
- `RegistryEntry`, `RegistryResponse` — the shape served at `/.well-known/ops`.
- `ErrorEntry`, `ErrorsResponse` — the shape served at `/.well-known/errors`.
- `defineError`, `isOpenCallError` — create and detect OpenCALL-aware error classes with static metadata for dispatch, logging, and catalog generation.
- `InvalidEnvelopeError`, `SchemaValidationError`, `OpNotFoundError`, `OpRemovedError`, `AuthRequiredError`, `ForbiddenError`, `BackendUnavailableError`, `InternalError` — built-in protocol and service error classes.
- `DomainError` — deprecated throwable domain error wrapper; prefer `defineError()`.
- `domainError`, `protocolError` — response-shape constructors.

## Quick example

```ts
import { RequestEnvelopeSchema, type RequestEnvelope } from "@opencall/types"

const parse = RequestEnvelopeSchema.safeParse(rawBody)
if (!parse.success) {
  // ... return 400
}
const envelope: RequestEnvelope = parse.data
```

## Defining Errors

```ts
import { defineError } from "@opencall/types"

export const ItemNotFoundError = defineError({
  code: "ITEM_NOT_FOUND",
  httpStatus: 200,
  message: "Item not found",
  retryable: false,
})

throw new ItemNotFoundError({ itemId: "123" })
```

Errors created by `defineError()` serialize OpenCALL-specific fields through `toJSON()` and include the stack through `toLog()`.

## OpenCALL spec compatibility

This package targets OpenCALL spec `callVersion: 2026-02-10`. See the canonical site for spec history and migration notes.

## License

Apache-2.0
