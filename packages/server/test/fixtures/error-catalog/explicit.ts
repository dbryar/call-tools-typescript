import { defineError } from "../../../src/index.ts";

export const ExplicitError = defineError({
  code: "EXPLICIT_ERROR",
  httpStatus: 200,
  message: "Explicit error",
  retryable: false,
});

export const IgnoredError = defineError({
  code: "IGNORED_ERROR",
  httpStatus: 200,
  message: "Ignored error",
  retryable: false,
});

export const errors = [ExplicitError] as const;

