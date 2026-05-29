import type {
  ErrorEntry,
  ErrorsResponse,
  OpenCallErrorConstructor,
} from "@opencall/types";

function isOpenCallErrorConstructor(value: unknown): value is OpenCallErrorConstructor {
  return (
    typeof value === "function" &&
    (value as { __opencall?: unknown }).__opencall === true &&
    (value as { __catalog_exclude?: unknown }).__catalog_exclude !== true
  );
}

function toErrorEntry(error: OpenCallErrorConstructor): ErrorEntry {
  return {
    code: error.code,
    httpStatus: error.httpStatus,
    message: error.defaultMessage,
    retryable: error.retryable,
    category: error.category,
  };
}

function uniqueErrors(errors: OpenCallErrorConstructor[]): OpenCallErrorConstructor[] {
  const seen = new Set<string>();
  const result: OpenCallErrorConstructor[] = [];

  for (const error of errors) {
    if (seen.has(error.code)) continue;
    seen.add(error.code);
    result.push(error);
  }

  return result;
}

export function buildErrorCatalog(
  entries: OpenCallErrorConstructor[],
): ErrorsResponse {
  return {
    errors: uniqueErrors(entries)
      .filter(isOpenCallErrorConstructor)
      .map(toErrorEntry)
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
}

export function buildErrorCatalogFromModules(
  modules: Record<string, unknown>[],
): ErrorsResponse {
  const errors: OpenCallErrorConstructor[] = [];

  for (const mod of modules) {
    if (Array.isArray(mod.errors)) {
      errors.push(...mod.errors.filter(isOpenCallErrorConstructor));
      continue;
    }

    for (const value of Object.values(mod)) {
      if (isOpenCallErrorConstructor(value)) {
        errors.push(value);
      }
    }
  }

  return buildErrorCatalog(errors);
}

