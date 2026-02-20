import { z } from "zod/v4";
import {
  readFileSync as nodeReadFileSync,
  readdirSync as nodeReaddirSync,
} from "node:fs";
import { join, extname } from "node:path";
import { createHash as nodeCreateHash } from "node:crypto";
import { parseJSDoc } from "./jsdoc.js";
import type {
  OperationModule,
  RegistryEntry,
  RegistryResponse,
} from "./types.js";

/** Replaceable runtime dependencies for non-Node environments (e.g. Bun, Deno) */
export interface RuntimeAdapters {
  /** Read a file as UTF-8 string. Defaults to node:fs readFileSync. */
  readFileSync?: (path: string, encoding: "utf-8") => string;
  /** List filenames in a directory. Defaults to node:fs readdirSync. */
  readdirSync?: (path: string) => string[];
  /** Create a hash instance. Defaults to node:crypto createHash. */
  createHash?: (algorithm: string) => {
    update(data: string): { digest(encoding: "hex"): string };
  };
}

/** Options for building the operations registry */
export interface BuildRegistryOptions {
  /** Absolute path to the directory containing operation .ts files */
  opsDir: string;
  /** OpenCALL version string (defaults to env CALL_VERSION or "2026-02-10") */
  callVersion?: string;
  /** File extension to scan for (defaults to ".ts") */
  ext?: string;
  /** Override runtime dependencies for non-Node environments */
  runtime?: RuntimeAdapters;
}

/** Result of building the registry, including modules for dispatch */
export interface BuildRegistryResult {
  /** The serializable registry response (for /.well-known/ops) */
  registry: RegistryResponse;
  /** Map of operation name to its resolved module (args, result, handler) */
  modules: Map<string, OperationModule>;
  /** Pre-serialized JSON string */
  json: string;
  /** ETag hash of the JSON for conditional GET support */
  etag: string;
}

/**
 * Scan operation files, dynamically import modules, parse JSDoc metadata,
 * and build the operations registry.
 *
 * Each operation file should export:
 * - `args`: a Zod schema for the operation arguments
 * - `result`: a Zod schema for the operation result
 * - `handler`: an async function implementing the operation
 *
 * And include a JSDoc block with at minimum an `@op` tag:
 * ```
 * /** @op v1:catalog.list
 *  *  @execution sync
 *  *  @timeout 5000
 *  *  @security items:browse
 *  *\/
 * ```
 *
 * For non-Node runtimes, pass `runtime` adapters to replace fs/crypto:
 * ```
 * await buildRegistry({
 *   opsDir: "./operations",
 *   runtime: {
 *     readFileSync: Bun.file(path).text,
 *     readdirSync: (dir) => [...new Bun.Glob("*.ts").scanSync(dir)],
 *     createHash: (alg) => new Bun.CryptoHasher(alg),
 *   },
 * });
 * ```
 */
export async function buildRegistry(
  options: BuildRegistryOptions
): Promise<BuildRegistryResult> {
  const { opsDir, ext = ".ts" } = options;
  const callVersion =
    options.callVersion ?? process.env.CALL_VERSION ?? "2026-02-10";

  const readFile = options.runtime?.readFileSync ?? nodeReadFileSync;
  const readDir = options.runtime?.readdirSync ?? nodeReaddirSync;
  const hashCreate = options.runtime?.createHash ?? nodeCreateHash;

  const files = readDir(opsDir).filter((f) => extname(f) === ext);
  const entries: RegistryEntry[] = [];
  const modules = new Map<string, OperationModule>();

  for (const file of files) {
    const filePath = join(opsDir, file);
    const sourceText = readFile(filePath, "utf-8");
    const tags = parseJSDoc(sourceText);

    // Skip files that don't declare an @op tag
    if (!tags["op"]) continue;

    const mod = await import(filePath);

    // Store the module for dispatch
    const opModule: OperationModule = {
      args: mod.args,
      result: mod.result,
      handler: mod.handler,
    };
    if (tags["sunset"]) opModule.sunset = tags["sunset"];
    if (tags["replacement"]) opModule.replacement = tags["replacement"];
    modules.set(tags["op"], opModule);

    const entry: RegistryEntry = {
      op: tags["op"],
      argsSchema: z.toJSONSchema(mod.args),
      resultSchema: z.toJSONSchema(mod.result),
      sideEffecting: tags["flags"]?.includes("sideEffecting") ?? false,
      idempotencyRequired:
        tags["flags"]?.includes("idempotencyRequired") ?? false,
      executionModel:
        (tags["execution"] as "sync" | "async") ?? "sync",
      maxSyncMs: tags["timeout"] ? parseInt(tags["timeout"], 10) : 5000,
      ttlSeconds: tags["ttl"] ? parseInt(tags["ttl"], 10) : 0,
      authScopes: tags["security"] ? tags["security"].split(/\s+/) : [],
      cachingPolicy:
        (tags["cache"] as "none" | "server" | "location") ?? "none",
    };

    if (tags["flags"]?.includes("deprecated")) {
      entry.deprecated = true;
    }
    if (tags["sunset"]) entry.sunset = tags["sunset"];
    if (tags["replacement"]) entry.replacement = tags["replacement"];

    entries.push(entry);
  }

  const registry: RegistryResponse = { callVersion, operations: entries };
  const json = JSON.stringify(registry);
  const etag = `"${hashCreate("sha256").update(json).digest("hex")}"`;

  return { registry, modules, json, etag };
}
