import { describe, expect, test } from "bun:test";
import {
  BackendUnavailableError,
  DomainError,
  InvalidEnvelopeError,
  defineError,
  type OpenCallErrorConstructor,
} from "../src/index.ts";
import {
  buildErrorCatalog,
  buildErrorCatalogFromModules,
} from "../src/error-catalog.ts";

const ItemNotFoundError = defineError({
  code: "ITEM_NOT_FOUND",
  httpStatus: 200,
  message: "Item not found",
  retryable: false,
});

const ItemUnavailableError = defineError({
  code: "ITEM_UNAVAILABLE",
  httpStatus: 409,
  message: "Item is unavailable",
  retryable: true,
  category: "service",
});

describe("buildErrorCatalog", () => {
  test("serializes constructor static metadata into the errors response shape", () => {
    expect(buildErrorCatalog([ItemUnavailableError, ItemNotFoundError])).toEqual({
      errors: [
        {
          code: "ITEM_NOT_FOUND",
          httpStatus: 200,
          message: "Item not found",
          retryable: false,
          category: "domain",
        },
        {
          code: "ITEM_UNAVAILABLE",
          httpStatus: 409,
          message: "Item is unavailable",
          retryable: true,
          category: "service",
        },
      ],
    });
  });

  test("deduplicates errors by code and excludes catalog-excluded wrappers", () => {
    expect(buildErrorCatalog([
      ItemNotFoundError,
      ItemNotFoundError,
      DomainError as unknown as OpenCallErrorConstructor,
    ])).toEqual({
      errors: [
        {
          code: "ITEM_NOT_FOUND",
          httpStatus: 200,
          message: "Item not found",
          retryable: false,
          category: "domain",
        },
      ],
    });
  });
});

describe("buildErrorCatalogFromModules", () => {
  test("uses module.errors when present", () => {
    const IgnoredExport = defineError({
      code: "IGNORED_EXPORT",
      httpStatus: 200,
      message: "Ignored export",
      retryable: false,
    });

    expect(buildErrorCatalogFromModules([
      {
        errors: [ItemNotFoundError],
        IgnoredExport,
      },
    ])).toEqual({
      errors: [
        {
          code: "ITEM_NOT_FOUND",
          httpStatus: 200,
          message: "Item not found",
          retryable: false,
          category: "domain",
        },
      ],
    });
  });

  test("auto-discovers named exports with the OpenCALL marker", () => {
    const catalog = buildErrorCatalogFromModules([
      {
        ItemNotFoundError,
        ItemUnavailableError,
        notAnError: { __opencall: true },
      },
      {
        BackendUnavailableError,
        DomainError,
        InvalidEnvelopeError,
      },
    ]);

    expect(catalog.errors.map((entry) => entry.code)).toEqual([
      "BACKEND_UNAVAILABLE",
      "INVALID_ENVELOPE",
      "ITEM_NOT_FOUND",
      "ITEM_UNAVAILABLE",
    ]);
  });
});

