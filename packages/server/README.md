# @opencall/server

> **Docs:** [https://opencall-api.com](https://opencall-api.com) (human-readable). AI agents may prefer raw markdown at [`/spec`](https://opencall-api.com/spec) — GitHub blocks most non-Copilot bots.

Server-side tooling for implementing OpenCALL APIs in TypeScript. Provides the operation registry builder, JSDoc-driven operation discovery, dispatcher helpers, runtime payload validation, and a code generator.

Built on [`@opencall/types`](https://www.npmjs.com/package/@opencall/types) — the canonical Zod schemas and types are imported from there, not redefined.

## Install

```bash
npm install @opencall/server @opencall/types
# or
bun add @opencall/server @opencall/types
```

## Core principle: operation files are the source of truth

Do not declare operation metadata in a dispatcher or registry file. Operation metadata belongs **beside the handler and schemas** in the operation file itself, as a JSDoc block:

```ts
/**
 * @op orders.getItem:v1
 * @execution sync
 * @timeout 5000
 * @security orders:read
 * @cache server
 * @ttl 300
 */
export const args = z.object({ orderId: z.string(), itemId: z.string() })
export const result = z.object({ id: z.string(), name: z.string(), price: z.number() })
export async function handler(input: unknown): Promise<OperationResult> { ... }
```

The registry is generated from these files — it's never a separate artifact you maintain. Keeping metadata with the code prevents the drift that occurs when registries are hand-authored.

## Node / Bun (runtime discovery)

`buildRegistry` scans the directory, reads each JSDoc block, and emits a spec-aligned `/.well-known/ops` response:

```ts
import { buildRegistry, validateEnvelope, validateArgs, safeHandlerCall } from "@opencall/server"

const { modules } = await buildRegistry({ opsDir: "./src/operations" })

// Inside your HTTP handler:
const envResult = validateEnvelope(rawBody)
if (!envResult.ok) return envResult.error          // { status, body }

const operation = modules.get(envResult.envelope.op)
if (!operation) return { status: 400, body: { ... } }

const argsResult = validateArgs(operation, envResult.envelope.args, requestId)
if (!argsResult.ok) return argsResult.error

const result = await safeHandlerCall(operation.handler, [argsResult.data], requestId)
```

## Cloudflare Workers / edge runtimes (build-time generation)

Edge runtimes lack `node:fs`, so scanning operation files at runtime is not possible. Use `opencall-generate-server-registry` to generate a pre-imported module at build time:

```bash
npx opencall-generate-server-registry --ops src/operations --out src/operations.generated.ts
```

The generated file (`src/operations.generated.ts`) imports each operation module and embeds the JSDoc-parsed metadata — it is always regenerated from source, never hand-authored:

```ts
// Auto-generated — DO NOT EDIT
import type { ModuleEntry } from "@opencall/server";
import * as ordersGetItem from "./operations/orders-get-item.js";
// ...

export const operationEntries: ModuleEntry[] = [
  { module: ordersGetItem, meta: { op: "orders.getItem:v1", execution: "sync", ... } },
  // ...
];
```

Pass this to `buildRegistryFromModules` in your Worker entry point:

```ts
import { buildRegistryFromModules } from "@opencall/server"
import { operationEntries } from "./operations.generated.js"

const { modules, json, etag } = buildRegistryFromModules(operationEntries)
```

Add a `prebuild` script to keep it in sync and a CI check to catch drift:

```json
{
  "scripts": {
    "prebuild": "opencall-generate-server-registry --ops src/operations --out src/operations.generated.ts",
    "check:registry": "opencall-generate-server-registry --ops src/operations --out src/operations.generated.ts --check"
  }
}
```

`--check` reads operation sources, generates the expected output in memory, and exits 1 if the file on disk differs or is missing — without writing anything. Add it to your CI pipeline to catch generated files that weren't regenerated after an `@op` change.

## Surface

- `buildRegistry` — scan operation files at runtime (Node/Bun). The primary API.
- `buildRegistryFromModules` — accept pre-imported modules for edge runtimes. Feed it output from `opencall-generate-server-registry`, not hand-authored metadata.
- `parseJSDoc` — extract operation metadata from JSDoc. Used internally; exposed for tooling.
- `validateEnvelope`, `validateArgs`, `safeHandlerCall`, `formatResponse`, `checkSunset` — dispatcher building blocks.
- `isDbConnectionError` — heuristic detection of DB connection failures, returns BACKEND_UNAVAILABLE.
- All `@opencall/types` exports are re-exported (no need to install `@opencall/types` separately).

## CLIs

| Command | Purpose |
| ------- | ------- |
| `opencall-generate-server-registry` | Scan operation JSDoc → emit `operations.generated.ts` for Workers |
| `opencall-generate-server-registry --check` | Verify `operations.generated.ts` matches sources — exits 1 if out of sync (CI drift detection) |
| `opencall-generate-ops` | Fetch `/.well-known/ops` → emit typed client call wrappers |

## OpenCALL spec compatibility

This package targets OpenCALL spec `callVersion: 2026-02-10`. The `@opencall/types` peer dependency declares the same.

## License

Apache-2.0
