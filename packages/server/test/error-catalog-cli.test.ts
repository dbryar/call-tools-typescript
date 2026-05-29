import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const cliPath = join(import.meta.dir, "../src/cli/generate-error-catalog.ts");
const fixturesGlob = join(import.meta.dir, "fixtures/error-catalog/*.ts");

describe("opencall-generate-error-catalog", () => {
  test("writes catalog JSON to stdout", () => {
    const result = spawnSync(
      process.execPath,
      [cliPath, "--ops", fixturesGlob],
      { encoding: "utf-8" },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      errors: [
        {
          code: "AUTO_ERROR",
          httpStatus: 503,
          message: "Auto error",
          retryable: true,
          category: "service",
        },
        {
          code: "EXPLICIT_ERROR",
          httpStatus: 200,
          message: "Explicit error",
          retryable: false,
          category: "domain",
        },
      ],
    });
  });

  test("writes and checks an output file", () => {
    const dir = mkdtempSync(join(tmpdir(), "opencall-errors-"));
    const out = join(dir, "errors.json");

    try {
      const writeResult = spawnSync(
        process.execPath,
        [cliPath, "--ops", fixturesGlob, "--out", out],
        { encoding: "utf-8" },
      );
      expect(writeResult.status).toBe(0);
      expect(JSON.parse(readFileSync(out, "utf-8")).errors).toHaveLength(2);

      const checkResult = spawnSync(
        process.execPath,
        [cliPath, "--ops", fixturesGlob, "--out", out, "--check"],
        { encoding: "utf-8" },
      );
      expect(checkResult.status).toBe(0);
      expect(checkResult.stdout).toContain("up to date");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

