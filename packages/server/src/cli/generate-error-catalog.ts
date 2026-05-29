#!/usr/bin/env node
/**
 * CLI: Import operation modules and emit a /.well-known/errors catalog JSON file.
 *
 * Usage:
 *   opencall-generate-error-catalog --ops dist/operations --out public/.well-known/errors
 *   opencall-generate-error-catalog --ops "dist/operations/*.js"
 *   opencall-generate-error-catalog --ops dist/operations --out public/.well-known/errors --check
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildErrorCatalogFromModules } from "../error-catalog.js";

interface CliArgs {
  ops: string;
  out?: string;
  ext: string;
  check: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<CliArgs> = { ext: ".js", check: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--ops":
        parsed.ops = args[++i];
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
        console.log(`Usage: opencall-generate-error-catalog --ops <dir|glob> [--out <file>] [--check]

Imports operation modules, discovers OpenCALL error classes, and emits the
/.well-known/errors JSON shape. If --out is omitted, JSON is written to stdout.

Options:
  --ops <dir|glob>  Directory or one-star glob of operation modules (required)
  --out <file>      Output JSON file path. Omit to write JSON to stdout.
  --ext <ext>       File extension when --ops is a directory (default: .js)
  --check           Verify the output file is up to date without writing it.`);
        process.exit(0);
    }
  }

  if (!parsed.ops) {
    console.error("Error: --ops is required");
    process.exit(1);
  }

  return {
    ops: parsed.ops,
    out: parsed.out,
    ext: parsed.ext ?? ".js",
    check: parsed.check ?? false,
  };
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`);
}

function resolveModuleFiles(ops: string, ext: string): string[] {
  const absoluteOps = resolve(ops);

  if (!ops.includes("*")) {
    if (!existsSync(absoluteOps)) {
      console.error(`Error: ${ops} does not exist`);
      process.exit(1);
    }

    const stats = statSync(absoluteOps);
    if (stats.isDirectory()) {
      return readdirSync(absoluteOps)
        .filter((file) => extname(file) === ext)
        .sort()
        .map((file) => join(absoluteOps, file));
    }

    return [absoluteOps];
  }

  const directory = dirname(absoluteOps);
  const pattern = wildcardToRegExp(basename(absoluteOps));

  if (!existsSync(directory)) {
    console.error(`Error: ${dirname(ops)} does not exist`);
    process.exit(1);
  }

  return readdirSync(directory)
    .filter((file) => pattern.test(file))
    .sort()
    .map((file) => join(directory, file));
}

async function importModules(files: string[]): Promise<Record<string, unknown>[]> {
  const modules: Record<string, unknown>[] = [];

  for (const file of files) {
    modules.push((await import(pathToFileURL(file).href)) as Record<string, unknown>);
  }

  return modules;
}

async function main() {
  const { ops, out, ext, check } = parseArgs();
  const files = resolveModuleFiles(ops, ext);

  if (files.length === 0) {
    console.error(`Error: no operation modules matched ${ops}`);
    process.exit(1);
  }

  const modules = await importModules(files);
  const content = `${JSON.stringify(buildErrorCatalogFromModules(modules), null, 2)}\n`;

  if (!out) {
    if (check) {
      console.error("Error: --check requires --out");
      process.exit(1);
    }
    process.stdout.write(content);
    return;
  }

  if (check) {
    if (!existsSync(out)) {
      console.error(`check failed: ${out} does not exist — run opencall-generate-error-catalog to generate it`);
      process.exit(1);
    }
    const existing = readFileSync(out, "utf-8");
    if (existing === content) {
      console.log(`ok: ${out} is up to date (${files.length} module${files.length === 1 ? "" : "s"})`);
      process.exit(0);
    }
    console.error(`check failed: ${out} is out of sync with operation sources`);
    console.error(`Run: opencall-generate-error-catalog --ops ${ops} --out ${out}`);
    process.exit(1);
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, content, "utf-8");
  console.log(`Generated error catalog from ${files.length} module${files.length === 1 ? "" : "s"} → ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

