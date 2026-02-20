import { test, expect, describe } from "bun:test";
import { RequestEnvelopeSchema } from "../src/envelope.ts";

describe("RequestEnvelopeSchema", () => {
  test("accepts minimal envelope with just op", () => {
    const result = RequestEnvelopeSchema.safeParse({ op: "v1:test.op" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.op).toBe("v1:test.op");
      expect(result.data.args).toEqual({});
    }
  });

  test("accepts full envelope with all fields", () => {
    const input = {
      op: "v1:test.op",
      args: { name: "test", count: 5 },
      ctx: {
        requestId: "550e8400-e29b-41d4-a716-446655440000",
        sessionId: "660e8400-e29b-41d4-a716-446655440000",
        idempotencyKey: "abc-123",
      },
      media: [
        { name: "photo.jpg", mimeType: "image/jpeg", ref: "https://example.com/photo.jpg" },
      ],
    };
    const result = RequestEnvelopeSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.args).toEqual({ name: "test", count: 5 });
      expect(result.data.ctx?.requestId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result.data.media).toHaveLength(1);
    }
  });

  test("rejects missing op field", () => {
    const result = RequestEnvelopeSchema.safeParse({ args: {} });
    expect(result.success).toBe(false);
  });

  test("rejects invalid ctx.requestId (not a UUID)", () => {
    const result = RequestEnvelopeSchema.safeParse({
      op: "v1:test.op",
      ctx: { requestId: "not-a-uuid" },
    });
    expect(result.success).toBe(false);
  });

  test("defaults args to empty object when omitted", () => {
    const result = RequestEnvelopeSchema.safeParse({ op: "v1:test.op" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.args).toEqual({});
    }
  });
});
