import { test, expect, describe } from "bun:test";
import { z } from "zod/v4";
import { buildRegistryFromModules } from "../src/registry.ts";
import type { OperationModule } from "@opencall/types";
import type { ModuleEntry } from "../src/registry.ts";

// ── Fixture modules (simulating pre-imported operation files) ────────────

const greetingModule: OperationModule = {
  args: z.object({ name: z.string() }),
  result: z.object({ message: z.string() }),
  handler: async (input: unknown) => ({
    state: "complete" as const,
    result: { message: `Hello, ${(input as { name: string }).name}!` },
  }),
};

const farewellModule: OperationModule = {
  args: z.object({ name: z.string() }),
  result: z.object({ message: z.string() }),
  handler: async (input: unknown) => ({
    state: "complete" as const,
    result: { message: `Goodbye, ${(input as { name: string }).name}!` },
  }),
  sunset: "2025-01-01",
  replacement: "greeting.farewell:v2",
};

const entries: ModuleEntry[] = [
  {
    module: greetingModule,
    meta: {
      op: "greeting.hello:v1",
      execution: "sync",
      timeout: 3000,
      onTimeout: "fail",
      security: "greet:read",
      cache: "public",
      cacheTtl: 300,
      cacheVary: ["args.locale"],
      cacheTags: ["greeting"],
      telemetry: {
        spanName: "greeting.hello",
        attributes: ["name"],
      },
    },
  },
  {
    module: farewellModule,
    meta: {
      op: "greeting.farewell:v1",
      execution: "sync",
      timeout: 2000,
      onTimeout: "escalate",
      security: "greet:read greet:write",
      flags: "sideEffecting deprecated",
      idempotency: {
        supported: true,
        required: true,
        ttlSeconds: 86400,
        keyHeader: "Idempotency-Key",
      },
      telemetry: {
        spanName: "greeting.farewell",
        attributes: ["name"],
        sensitive: ["name"],
      },
    },
  },
];

// ── Tests ────────────────────────────────────────────────────────────────

describe("buildRegistryFromModules", () => {
  test("builds registry from inline modules", () => {
    const { registry, modules } = buildRegistryFromModules(entries);

    expect(registry.operations).toHaveLength(2);
    expect(modules.size).toBe(2);

    const opNames = registry.operations.map((e) => e.op).sort();
    expect(opNames).toEqual(["greeting.farewell:v1", "greeting.hello:v1"]);
  });

  test("parses execution model from meta", () => {
    const { registry } = buildRegistryFromModules(entries);
    const hello = registry.operations.find((e) => e.op === "greeting.hello:v1");
    expect(hello?.executionModel).toBe("sync");
  });

  test("builds sync policy from meta", () => {
    const { registry } = buildRegistryFromModules(entries);
    const hello = registry.operations.find((e) => e.op === "greeting.hello:v1");
    expect(hello?.sync).toEqual({ maxMs: 3000, onTimeout: "fail" });
  });

  test("parses auth scopes from meta", () => {
    const { registry } = buildRegistryFromModules(entries);

    const hello = registry.operations.find((e) => e.op === "greeting.hello:v1");
    expect(hello?.authScopes).toEqual(["greet:read"]);

    const farewell = registry.operations.find((e) => e.op === "greeting.farewell:v1");
    expect(farewell?.authScopes).toEqual(["greet:read", "greet:write"]);
  });

  test("parses flags (sideEffecting, deprecated)", () => {
    const { registry } = buildRegistryFromModules(entries);

    const hello = registry.operations.find((e) => e.op === "greeting.hello:v1");
    expect(hello?.sideEffecting).toBe(false);
    expect(hello?.deprecated).toBeUndefined();

    const farewell = registry.operations.find((e) => e.op === "greeting.farewell:v1");
    expect(farewell?.sideEffecting).toBe(true);
    expect(farewell?.deprecated).toBe(true);
  });

  test("builds idempotency, cache, and telemetry blocks", () => {
    const { registry } = buildRegistryFromModules(entries);
    const hello = registry.operations.find((e) => e.op === "greeting.hello:v1");
    const farewell = registry.operations.find((e) => e.op === "greeting.farewell:v1");

    expect(hello?.cache).toEqual({
      enabled: true,
      ttl: 300,
      scope: "public",
      vary: ["args.locale"],
      tags: ["greeting"],
    });
    expect(hello?.telemetry).toEqual({
      spanName: "greeting.hello",
      attributes: ["name"],
    });

    expect(farewell?.idempotency).toEqual({
      supported: true,
      required: true,
      ttlSeconds: 86400,
      keyHeader: "Idempotency-Key",
    });
    expect(farewell?.telemetry).toEqual({
      spanName: "greeting.farewell",
      attributes: ["name"],
      sensitive: ["name"],
    });
  });

  test("picks up sunset/replacement from module when not in meta", () => {
    const { registry, modules } = buildRegistryFromModules(entries);
    const farewell = registry.operations.find((e) => e.op === "greeting.farewell:v1");
    expect(farewell?.sunset).toBe("2025-01-01");
    expect(farewell?.replacement).toBe("greeting.farewell:v2");

    const mod = modules.get("greeting.farewell:v1");
    expect(mod?.sunset).toBe("2025-01-01");
    expect(mod?.replacement).toBe("greeting.farewell:v2");
  });

  test("meta sunset/replacement overrides module values", () => {
    const { registry } = buildRegistryFromModules([
      {
        module: farewellModule,
        meta: {
          op: "greeting.farewell:v1",
          sunset: "2026-06-01",
          replacement: "greeting.farewell:v3",
        },
      },
    ]);
    const farewell = registry.operations.find((e) => e.op === "greeting.farewell:v1");
    expect(farewell?.sunset).toBe("2026-06-01");
    expect(farewell?.replacement).toBe("greeting.farewell:v3");
  });

  test("generates JSON Schema for args and result", () => {
    const { registry } = buildRegistryFromModules(entries);
    const hello = registry.operations.find((e) => e.op === "greeting.hello:v1");

    expect(hello?.argsSchema).toBeDefined();
    expect(hello?.resultSchema).toBeDefined();
    expect((hello?.argsSchema as Record<string, unknown>).type).toBe("object");
    expect((hello?.resultSchema as Record<string, unknown>).type).toBe("object");
  });

  test("uses custom callVersion", () => {
    const { registry } = buildRegistryFromModules(entries, {
      callVersion: "2026-03-01",
      endpoints: ["rpc", "path"],
      errorsUrl: "/.well-known/errors",
    });
    expect(registry.callVersion).toBe("2026-03-01");
    expect(registry.endpoints).toEqual(["rpc", "path"]);
    expect(registry.errorsUrl).toBe("/.well-known/errors");
  });

  test("generates schemaHash, etag, and json", () => {
    const { json, etag } = buildRegistryFromModules(entries);
    expect(json).toBeTruthy();
    expect(etag).toMatch(/^"sha256:[a-f0-9]{64}"$/);

    const parsed = JSON.parse(json);
    expect(parsed.operations).toBeArray();
    expect(parsed.operations).toHaveLength(2);
    expect(parsed.schemaHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(parsed.endpoints).toEqual(["rpc"]);
  });

  test("etag is deterministic for same input", () => {
    const r1 = buildRegistryFromModules(entries);
    const r2 = buildRegistryFromModules(entries);
    expect(r1.etag).toBe(r2.etag);
  });

  test("modules contain working handlers", () => {
    const { modules } = buildRegistryFromModules(entries);
    const hello = modules.get("greeting.hello:v1");
    expect(hello).toBeDefined();
  });

  test("handles empty module list", () => {
    const { registry, modules, json } = buildRegistryFromModules([]);
    expect(registry.operations).toHaveLength(0);
    expect(modules.size).toBe(0);
    expect(JSON.parse(json).operations).toEqual([]);
  });

  test("defaults unset meta fields", () => {
    const { registry } = buildRegistryFromModules([
      {
        module: greetingModule,
        meta: { op: "minimal.op:v1" },
      },
    ]);
    const op = registry.operations[0];
    expect(op.executionModel).toBe("sync");
    expect(op.sync).toEqual({ maxMs: 5000, onTimeout: "fail" });
    expect(op.ttlSeconds).toBeUndefined();
    expect(op.authScopes).toEqual([]);
    expect(op.cache).toBeUndefined();
    expect(op.sideEffecting).toBe(false);
  });

  test("produces same output as buildRegistry for equivalent input", async () => {
    // Import the fixture modules the same way buildRegistry would
    const { buildRegistry } = await import("../src/registry.ts");
    const { join } = await import("node:path");
    const fixturesDir = join(import.meta.dir, "fixtures", "operations");

    const fsResult = await buildRegistry({ opsDir: fixturesDir });

    // Build equivalent from modules — get the actual fixture modules
    const greetMod = await import("./fixtures/operations/greeting.ts");
    const farewellMod = await import("./fixtures/operations/farewell.ts");

    const modResult = buildRegistryFromModules([
      {
        module: greetMod,
        meta: {
          op: "greeting.hello:v1",
          execution: "sync",
          timeout: 3000,
          onTimeout: "fail",
          security: "greet:read",
          cache: "public",
          cacheTtl: 300,
          cacheVary: ["args.locale"],
          cacheTags: ["greeting"],
          telemetry: {
            spanName: "greeting.hello",
            attributes: ["name"],
          },
        },
      },
      {
        module: farewellMod,
        meta: {
          op: "greeting.farewell:v1",
          execution: "sync",
          timeout: 2000,
          onTimeout: "escalate",
          security: "greet:read greet:write",
          flags: "sideEffecting deprecated",
          sunset: "2025-01-01",
          replacement: "greeting.goodbye:v1",
          cache: "none",
          idempotency: {
            supported: true,
            required: true,
            ttlSeconds: 86400,
            keyHeader: "Idempotency-Key",
          },
          telemetry: {
            spanName: "greeting.farewell",
            attributes: ["name"],
            sensitive: ["name"],
          },
        },
      },
    ]);

    // Registry entries should match
    const sortOps = (ops: typeof fsResult.registry.operations) =>
      [...ops].sort((a, b) => a.op.localeCompare(b.op));

    expect(sortOps(modResult.registry.operations)).toEqual(
      sortOps(fsResult.registry.operations)
    );
  });
});
