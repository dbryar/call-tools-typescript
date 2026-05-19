import { test, expect, describe } from "bun:test";
import { parseJSDoc } from "../src/jsdoc.ts";

describe("parseJSDoc", () => {
  test("extracts single tags", () => {
    const source = `
/** @op catalog.list:v1
 *  @execution sync
 *  @timeout 5000
 *  @onTimeout fail
 */
`;
    const tags = parseJSDoc(source);
    expect(tags.op).toBe("catalog.list:v1");
    expect(tags.execution).toBe("sync");
    expect(tags.timeout).toBe("5000");
    expect(tags.onTimeout).toBe("fail");
  });

  test("accumulates repeated tags with space separator", () => {
    const source = `
/** @op item.get:v1
 *  @security items:read
 *  @security items:browse
 */
`;
    const tags = parseJSDoc(source);
    expect(tags.security).toBe("items:read items:browse");
  });

  test("handles flags with multiple values", () => {
    const source = `
/** @op item.update:v1
 *  @flags sideEffecting idempotencyRequired
 */
`;
    const tags = parseJSDoc(source);
    expect(tags.flags).toContain("sideEffecting");
    expect(tags.flags).toContain("idempotencyRequired");
  });

  test("returns empty object when no JSDoc block exists", () => {
    const source = `// just a comment\nconst x = 1;`;
    expect(parseJSDoc(source)).toEqual({});
  });

  test("returns empty object for JSDoc with no tags", () => {
    const source = `/** Just a description with no tags */`;
    expect(parseJSDoc(source)).toEqual({});
  });

  test("handles all supported OpenCALL tags", () => {
    const source = `
/** @op report.generate:v1
 *  @execution async
 *  @timeout 30000
 *  @ttl 3600
 *  @cache public
 *  @cacheTtl 300
 *  @flags sideEffecting deprecated
 *  @idempotency required ttl=86400 header=Idempotency-Key
 *  @telemetry span=report.generate
 *  @telemetryAttributes reportId,status
 *  @telemetrySensitive accountNumber
 *  @sunset 2025-06-01
 *  @replacement report.generate:v2
 */
`;
    const tags = parseJSDoc(source);
    expect(tags.op).toBe("report.generate:v1");
    expect(tags.execution).toBe("async");
    expect(tags.timeout).toBe("30000");
    expect(tags.ttl).toBe("3600");
    expect(tags.cache).toBe("public");
    expect(tags.cacheTtl).toBe("300");
    expect(tags.idempotency).toBe("required ttl=86400 header=Idempotency-Key");
    expect(tags.telemetry).toBe("span=report.generate");
    expect(tags.telemetryAttributes).toBe("reportId,status");
    expect(tags.telemetrySensitive).toBe("accountNumber");
    expect(tags.flags).toContain("deprecated");
    expect(tags.sunset).toBe("2025-06-01");
    expect(tags.replacement).toBe("report.generate:v2");
  });

  test("only parses the first JSDoc block", () => {
    const source = `
/** @op first.op:v1 */

/** @op second.op:v1 */
`;
    const tags = parseJSDoc(source);
    expect(tags.op).toBe("first.op:v1");
  });
});
