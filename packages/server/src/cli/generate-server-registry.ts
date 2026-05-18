#!/usr/bin/env node
/**
 * CLI: Scan operation source files and emit a pre-imported server registry module.
 *
 * This is the build-time counterpart to buildRegistry(). Run it as part of your
 * Worker / edge-runtime build to produce a static operations.generated.ts. The
 * generated file is fed into buildRegistryFromModules() — metadata is always
 * derived from source JSDoc annotations, never hand-authored.
 *
 * Usage:
 *   opencall-generate-server-registry --ops src/operations --out src/operations.generated.ts
 *   opencall-generate-server-registry --ops src/operations --out src/operations.generated.ts --check
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, dirname, extname, basename } from "node:path";
import { parseJSDoc } from "../jsdoc.js";

interface CliArgs {
  opsDir: string;
  out: string;
  ext: string;
  check: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<CliArgs> = { ext: ".ts", check: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--ops":
        parsed.opsDir = args[++i];
        break;
      case "--out":
        parsed.out = args[++i];
        break;
      case "--ext":
        parsed.ext = args[++i];
        break;
      case "--check":
        parsed.check = true;
        break;
      case "--help":
      case "-h":
        console.log(`Usage: opencall-generate-server-registry --ops <dir> --out <file> [--check]

Scans operation files, reads their JSDoc @op annotations, and emits a pre-imported
TypeScript module for use with buildRegistryFromModules() in edge runtimes.

The generated file always reflects the current operation source annotations.
Import it instead of hand-authoring ModuleEntry metadata.

Options:
  --ops <dir>   Directory containing operation source files (required)
  --out <file>  Output file path (default: src/operations.generated.ts)
  --ext <ext>   File extension to scan (default: .ts)
  --check       Verify the output file is up to date without writing it.
                Exits 1 if the file is missing or out of sync — use in CI to
                catch generated files that were not regenerated after an @op change.`);
        process.exit(0);
    }
  }

  if (!parsed.opsDir) {
    console.error("Error: --ops is required");
    process.exit(1);
  }

  return {
    opsDir: parsed.opsDir,
    out: parsed.out ?? "src/operations.generated.ts",
    ext: parsed.ext ?? ".ts",
    check: parsed.check ?? false,
  };
}

function toIdentifier(stem: string): string {
  return stem
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => (c as string).toUpperCase())
    .replace(/^[0-9]/, "_$&");
}

function tagsToMetaLines(tags: Record<string, string>): string[] {
  const lines: string[] = [`op: ${JSON.stringify(tags.op)}`];

  if (tags.execution) lines.push(`execution: ${JSON.stringify(tags.execution)}`);

  const timeout = tags.timeout ? parseInt(tags.timeout, 10) : NaN;
  if (!isNaN(timeout)) lines.push(`timeout: ${timeout}`);

  if (tags.onTimeout) lines.push(`onTimeout: ${JSON.stringify(tags.onTimeout)}`);

  const ttl = tags.ttl ? parseInt(tags.ttl, 10) : NaN;
  if (!isNaN(ttl) && ttl > 0) lines.push(`ttl: ${ttl}`);

  if (tags.security) lines.push(`security: ${JSON.stringify(tags.security)}`);

  if (tags.cache && tags.cache !== "none") {
    lines.push(`cache: ${JSON.stringify(tags.cache)}`);

    const cacheTtl = tags.cacheTtl
      ? parseInt(tags.cacheTtl, 10)
      : !isNaN(ttl) ? ttl : NaN;
    if (!isNaN(cacheTtl) && cacheTtl > 0) lines.push(`cacheTtl: ${cacheTtl}`);
    if (tags.cacheVary) lines.push(`cacheVary: ${JSON.stringify(tags.cacheVary)}`);
    if (tags.cacheTags) lines.push(`cacheTags: ${JSON.stringify(tags.cacheTags)}`);
  }

  if (tags.flags) lines.push(`flags: ${JSON.stringify(tags.flags)}`);
  if (tags.sunset) lines.push(`sunset: ${JSON.stringify(tags.sunset)}`);
  if (tags.replacement) lines.push(`replacement: ${JSON.stringify(tags.replacement)}`);

  return lines;
}

interface OpEntry {
  identifier: string;
  importPath: string;
  metaLines: string[];
}

function buildContent(opsDir: string, out: string, ext: string): { content: string; count: number } {
  const files = readdirSync(opsDir)
    .filter((f) => extname(f) === ext)
    .sort();

  if (files.length === 0) {
    console.error(`No ${ext} files found in ${opsDir}`);
    process.exit(1);
  }

  const ops: OpEntry[] = [];
  const relBase = relative(dirname(out), opsDir).replace(/\\/g, "/") || ".";

  for (const file of files) {
    const source = readFileSync(join(opsDir, file), "utf-8");
    const tags = parseJSDoc(source);
    if (!tags.op) continue;

    const stem = basename(file, ext);
    ops.push({
      identifier: toIdentifier(stem),
      importPath: `${relBase}/${stem}.js`,
      metaLines: tagsToMetaLines(tags),
    });
  }

  if (ops.length === 0) {
    console.error(`No @op-annotated files found in ${opsDir}`);
    process.exit(1);
  }

  const lines: string[] = [
    `// Auto-generated by opencall-generate-server-registry — DO NOT EDIT`,
    `// Regenerate: opencall-generate-server-registry --ops ${opsDir} --out ${out}`,
    `// Metadata is derived from JSDoc annotations — edit operation source files, not this file.`,
    ``,
    `import type { ModuleEntry } from "@opencall/server";`,
  ];

  for (const op of ops) {
    lines.push(`import * as ${op.identifier} from ${JSON.stringify(op.importPath)};`);
  }

  lines.push(``, `export const operationEntries: ModuleEntry[] = [`);

  for (const op of ops) {
    lines.push(`  {`);
    lines.push(`    module: ${op.identifier},`);
    lines.push(`    meta: {`);
    for (const line of op.metaLines) {
      lines.push(`      ${line},`);
    }
    lines.push(`    },`);
    lines.push(`  },`);
  }

  lines.push(`];`, ``);

  return { content: lines.join("\n"), count: ops.length };
}

async function main() {
  const { opsDir, out, ext, check } = parseArgs();
  const { content, count } = buildContent(opsDir, out, ext);

  if (check) {
    if (!existsSync(out)) {
      console.error(`check failed: ${out} does not exist — run opencall-generate-server-registry to generate it`);
      process.exit(1);
    }
    const existing = readFileSync(out, "utf-8");
    if (existing === content) {
      console.log(`ok: ${out} is up to date (${count} operation${count === 1 ? "" : "s"})`);
      process.exit(0);
    }
    console.error(`check failed: ${out} is out of sync with operation sources`);
    console.error(`Run: opencall-generate-server-registry --ops ${opsDir} --out ${out}`);
    process.exit(1);
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, content, "utf-8");
  console.log(`Generated ${count} operation${count === 1 ? "" : "s"} → ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
