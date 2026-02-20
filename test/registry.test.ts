import { test, expect, describe } from "bun:test";
import { join } from "node:path";
import { buildRegistry } from "../src/registry.ts";

const fixturesDir = join(import.meta.dir, "fixtures", "operations");

describe("buildRegistry", () => {
  test("discovers operations with @op tags", async () => {
    const { registry, modules } = await buildRegistry({ opsDir: fixturesDir });

    // Should find greeting and farewell, but skip no-op-tag
    expect(registry.operations).toHaveLength(2);
    expect(modules.size).toBe(2);

    const opNames = registry.operations.map((e) => e.op).sort();
    expect(opNames).toEqual(["v1:greeting.farewell", "v1:greeting.hello"]);
  });

  test("skips files without @op tag", async () => {
    const { registry } = await buildRegistry({ opsDir: fixturesDir });
    const opNames = registry.operations.map((e) => e.op);
    expect(opNames).not.toContain(undefined);
    // no-op-tag.ts should not appear
    expect(registry.operations.length).toBe(2);
  });

  test("parses execution model from JSDoc", async () => {
    const { registry } = await buildRegistry({ opsDir: fixturesDir });
    const hello = registry.operations.find((e) => e.op === "v1:greeting.hello");
    expect(hello?.executionModel).toBe("sync");
  });

  test("parses timeout from JSDoc", async () => {
    const { registry } = await buildRegistry({ opsDir: fixturesDir });
    const hello = registry.operations.find((e) => e.op === "v1:greeting.hello");
    expect(hello?.maxSyncMs).toBe(3000);
  });

  test("parses auth scopes from JSDoc", async () => {
    const { registry } = await buildRegistry({ opsDir: fixturesDir });

    const hello = registry.operations.find((e) => e.op === "v1:greeting.hello");
    expect(hello?.authScopes).toEqual(["greet:read"]);

    // farewell has two @security lines
    const farewell = registry.operations.find((e) => e.op === "v1:greeting.farewell");
    expect(farewell?.authScopes).toEqual(["greet:read", "greet:write"]);
  });

  test("parses flags (sideEffecting, deprecated)", async () => {
    const { registry } = await buildRegistry({ opsDir: fixturesDir });

    const hello = registry.operations.find((e) => e.op === "v1:greeting.hello");
    expect(hello?.sideEffecting).toBe(false);
    expect(hello?.deprecated).toBeUndefined();

    const farewell = registry.operations.find((e) => e.op === "v1:greeting.farewell");
    expect(farewell?.sideEffecting).toBe(true);
    expect(farewell?.deprecated).toBe(true);
  });

  test("parses sunset and replacement", async () => {
    const { registry } = await buildRegistry({ opsDir: fixturesDir });
    const farewell = registry.operations.find((e) => e.op === "v1:greeting.farewell");
    expect(farewell?.sunset).toBe("2025-01-01");
    expect(farewell?.replacement).toBe("v1:greeting.goodbye");
  });

  test("generates JSON Schema for args and result", async () => {
    const { registry } = await buildRegistry({ opsDir: fixturesDir });
    const hello = registry.operations.find((e) => e.op === "v1:greeting.hello");

    // Should have a JSON Schema with properties
    expect(hello?.argsSchema).toBeDefined();
    expect(hello?.resultSchema).toBeDefined();
    expect((hello?.argsSchema as Record<string, unknown>).type).toBe("object");
    expect((hello?.resultSchema as Record<string, unknown>).type).toBe("object");
  });

  test("uses custom callVersion", async () => {
    const { registry } = await buildRegistry({
      opsDir: fixturesDir,
      callVersion: "2026-03-01",
    });
    expect(registry.callVersion).toBe("2026-03-01");
  });

  test("generates etag and json", async () => {
    const { json, etag } = await buildRegistry({ opsDir: fixturesDir });
    expect(json).toBeTruthy();
    expect(etag).toMatch(/^"[a-f0-9]{64}"$/);

    // JSON should parse back to registry
    const parsed = JSON.parse(json);
    expect(parsed.operations).toBeArray();
  });

  test("etag is deterministic for same input", async () => {
    const r1 = await buildRegistry({ opsDir: fixturesDir });
    const r2 = await buildRegistry({ opsDir: fixturesDir });
    expect(r1.etag).toBe(r2.etag);
  });

  test("modules contain working handlers", async () => {
    const { modules } = await buildRegistry({ opsDir: fixturesDir });
    const hello = modules.get("v1:greeting.hello");
    expect(hello).toBeDefined();

    const result = await hello!.handler({ name: "World" });
    expect(result).toEqual({
      state: "complete",
      result: { message: "Hello, World!" },
    });
  });

  test("modules store sunset/replacement metadata", async () => {
    const { modules } = await buildRegistry({ opsDir: fixturesDir });
    const farewell = modules.get("v1:greeting.farewell");
    expect(farewell?.sunset).toBe("2025-01-01");
    expect(farewell?.replacement).toBe("v1:greeting.goodbye");
  });
});
