import { DomainError, defineError } from "../../../src/index.ts";

export const AutoError = defineError({
  code: "AUTO_ERROR",
  httpStatus: 503,
  message: "Auto error",
  retryable: true,
  category: "service",
});

export const LegacyDomainError = DomainError;
export const notAnError = { __opencall: true };

