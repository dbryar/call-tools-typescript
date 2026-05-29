import { test, expect, describe } from "bun:test";
import {
  BackendUnavailableError,
  DomainError,
  InvalidEnvelopeError,
  SchemaValidationError,
  defineError,
  domainError,
  isOpenCallError,
  protocolError,
} from "../src/index.ts";

describe("defineError", () => {
  test("creates a marked OpenCALL error class from metadata", () => {
    const ItemNotFoundError = defineError({
      code: "ITEM_NOT_FOUND",
      httpStatus: 200,
      message: "Item not found",
      retryable: false,
    });

    const err = new ItemNotFoundError({ itemId: "123" });

    expect(ItemNotFoundError.__opencall).toBe(true);
    expect(ItemNotFoundError.code).toBe("ITEM_NOT_FOUND");
    expect(ItemNotFoundError.httpStatus).toBe(200);
    expect(ItemNotFoundError.defaultMessage).toBe("Item not found");
    expect(ItemNotFoundError.retryable).toBe(false);
    expect(ItemNotFoundError.category).toBe("domain");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ITEM_NOT_FOUND");
    expect(err.code).toBe("ITEM_NOT_FOUND");
    expect(err.httpStatus).toBe(200);
    expect(err.retryable).toBe(false);
    expect(err.category).toBe("domain");
    expect(err.message).toBe("Item not found");
    expect(err.cause).toEqual({ itemId: "123" });
    expect(isOpenCallError(err)).toBe(true);
  });

  test("serializes OpenCALL fields for JSON and logs", () => {
    const ParentError = defineError({
      code: "PARENT",
      httpStatus: 200,
      message: "Parent failed",
      retryable: false,
    });
    const ChildError = defineError({
      code: "CHILD",
      httpStatus: 409,
      message: "Child failed",
      retryable: true,
      category: "service",
    });

    const err = new ParentError(new ChildError({ detail: "x" }));

    expect(JSON.parse(JSON.stringify(err))).toEqual({
      code: "PARENT",
      category: "domain",
      httpStatus: 200,
      retryable: false,
      message: "Parent failed",
      cause: {
        code: "CHILD",
        category: "service",
        httpStatus: 409,
        retryable: true,
        message: "Child failed",
        cause: { detail: "x" },
      },
    });
    expect(typeof err.toLog().stack).toBe("string");
  });

  test("does not identify plain errors as OpenCALL errors", () => {
    expect(isOpenCallError(new Error("plain"))).toBe(false);
    expect(isOpenCallError({ __opencall: true })).toBe(false);
  });
});

describe("DomainError", () => {
  test("creates error with code and message", () => {
    const err = new DomainError("NOT_FOUND", "Item not found");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Item not found");
    expect(err.name).toBe("DomainError");
    expect(err).toBeInstanceOf(Error);
  });

  test("creates error with cause", () => {
    const cause = { id: "123" };
    const err = new DomainError("NOT_FOUND", "Item not found", cause);
    expect(err.cause).toEqual(cause);
  });
});

describe("domainError", () => {
  test("returns response envelope with state=error", () => {
    const resp = domainError("req-1", "ITEM_NOT_FOUND", "Not found");
    expect(resp.requestId).toBe("req-1");
    expect(resp.state).toBe("error");
    expect(resp.error?.code).toBe("ITEM_NOT_FOUND");
    expect(resp.error?.message).toBe("Not found");
  });

  test("includes cause when provided", () => {
    const resp = domainError("req-1", "FAIL", "oops", { detail: "x" });
    expect(resp.error?.cause).toEqual({ detail: "x" });
  });

  test("omits cause when not provided", () => {
    const resp = domainError("req-1", "FAIL", "oops");
    expect(resp.error?.cause).toBeUndefined();
  });
});

describe("protocolError", () => {
  test("returns status and error body", () => {
    const resp = protocolError("INVALID_ENVELOPE", "Bad request", 400);
    expect(resp.status).toBe(400);
    expect(resp.body.state).toBe("error");
    expect(resp.body.error?.code).toBe("INVALID_ENVELOPE");
  });

  test("generates a requestId", () => {
    const resp = protocolError("ERR", "msg", 500);
    expect(resp.body.requestId).toBeTruthy();
    // Should be a valid UUID format
    expect(resp.body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

describe("BackendUnavailableError", () => {
  test("BackendUnavailableError carries OpenCALL metadata", () => {
    const err = new BackendUnavailableError({ service: "postgres" });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BackendUnavailableError);
    expect(err.name).toBe("BACKEND_UNAVAILABLE");
    expect(err.code).toBe("BACKEND_UNAVAILABLE");
    expect(err.httpStatus).toBe(503);
    expect(err.retryable).toBe(true);
    expect(err.retriable).toBe(true);
    expect(err.category).toBe("service");
    expect(err.message).toBe("A backend dependency is unavailable.");
    expect(err.cause).toEqual({ service: "postgres" });
    expect(isOpenCallError(err)).toBe(true);
  });

  test("BackendUnavailableError supports the deprecated constructor shape", () => {
    const cause = new Error("ECONNREFUSED 127.0.0.1:5432");
    const err = new BackendUnavailableError("postgres", "down", cause);
    expect(err.cause).toBe(cause);
    expect(err.message).toBe("down");
    expect(err.service).toBe("postgres");
    expect(err.retriable).toBe(true);
  });
});

describe("built-in protocol errors", () => {
  test("export OpenCALL error classes for protocol failures", () => {
    const invalidEnvelope = new InvalidEnvelopeError();
    const validationError = new SchemaValidationError({ issues: [] });

    expect(InvalidEnvelopeError.__opencall).toBe(true);
    expect(invalidEnvelope.code).toBe("INVALID_ENVELOPE");
    expect(invalidEnvelope.httpStatus).toBe(400);
    expect(invalidEnvelope.category).toBe("protocol");
    expect(validationError.code).toBe("SCHEMA_VALIDATION_FAILED");
    expect(validationError.cause).toEqual({ issues: [] });
  });
});
