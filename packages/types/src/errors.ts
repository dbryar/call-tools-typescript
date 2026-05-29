import type { ResponseEnvelope } from "./envelope.js";

export type ErrorCategory = "domain" | "protocol" | "service";

export interface OpenCallErrorMeta {
  code: string;
  httpStatus: number;
  message: string;
  retryable: boolean;
  category?: ErrorCategory;
}

export interface SerializedOpenCallError {
  code: string;
  category: ErrorCategory;
  httpStatus: number;
  retryable: boolean;
  message: string;
  cause?: unknown;
}

export interface OpenCallErrorConstructor {
  readonly __opencall: true;
  readonly code: string;
  readonly httpStatus: number;
  readonly defaultMessage: string;
  readonly retryable: boolean;
  readonly category: ErrorCategory;
  new (cause?: unknown): OpenCallErrorInstance;
}

export interface OpenCallErrorInstance extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly category: ErrorCategory;
  toJSON(): SerializedOpenCallError;
  toLog(): SerializedOpenCallError & { stack?: string };
}

function serializeCause(cause: unknown): unknown {
  return isOpenCallError(cause) ? cause.toJSON() : cause;
}

export function defineError(meta: OpenCallErrorMeta): OpenCallErrorConstructor {
  const category = meta.category ?? "domain";

  class SpecificError extends Error implements OpenCallErrorInstance {
    static readonly __opencall = true as const;
    static readonly code = meta.code;
    static readonly httpStatus = meta.httpStatus;
    static readonly defaultMessage = meta.message;
    static readonly retryable = meta.retryable;
    static readonly category = category;

    readonly code = meta.code;
    readonly httpStatus = meta.httpStatus;
    readonly retryable = meta.retryable;
    readonly category = category;

    constructor(cause?: unknown) {
      super(meta.message, cause !== undefined ? { cause } : undefined);
      this.name = meta.code;
    }

    toJSON(): SerializedOpenCallError {
      return {
        code: this.code,
        category: this.category,
        httpStatus: this.httpStatus,
        retryable: this.retryable,
        message: this.message,
        ...(this.cause !== undefined && { cause: serializeCause(this.cause) }),
      };
    }

    toLog(): SerializedOpenCallError & { stack?: string } {
      return { ...this.toJSON(), stack: this.stack };
    }
  }

  return SpecificError;
}

export function isOpenCallError(value: unknown): value is OpenCallErrorInstance {
  if (typeof value !== "object" || value === null) return false;
  const constructor = Object.getPrototypeOf(value)?.constructor as
    | { __opencall?: unknown }
    | undefined;
  return constructor?.__opencall === true;
}

/** Construct a domain error response (HTTP 200, state=error) */
export function domainError(
  requestId: string,
  code: string,
  message: string,
  cause?: unknown
): ResponseEnvelope {
  return {
    requestId,
    state: "error",
    error: { code, message, ...(cause !== undefined && { cause }) },
  };
}

/** Construct a protocol error response (HTTP 4xx/5xx, state=error) */
export function protocolError(
  code: string,
  message: string,
  httpStatus: number,
  cause?: unknown
): { status: number; body: ResponseEnvelope } {
  return {
    status: httpStatus,
    body: {
      requestId: crypto.randomUUID(),
      state: "error",
      error: { code, message, ...(cause !== undefined && { cause }) },
    },
  };
}

export const InvalidEnvelopeError = defineError({
  code: "INVALID_ENVELOPE",
  httpStatus: 400,
  message: "Request envelope failed schema validation.",
  retryable: false,
  category: "protocol",
});

export const SchemaValidationError = defineError({
  code: "SCHEMA_VALIDATION_FAILED",
  httpStatus: 400,
  message: "Operation arguments failed validation.",
  retryable: false,
  category: "protocol",
});

export const OpNotFoundError = defineError({
  code: "OP_NOT_FOUND",
  httpStatus: 404,
  message: "No operation registered with that name.",
  retryable: false,
  category: "protocol",
});

export const OpRemovedError = defineError({
  code: "OP_REMOVED",
  httpStatus: 410,
  message: "Operation has been removed.",
  retryable: false,
  category: "protocol",
});

export const AuthRequiredError = defineError({
  code: "AUTH_REQUIRED",
  httpStatus: 401,
  message: "Authentication is required.",
  retryable: false,
  category: "protocol",
});

export const ForbiddenError = defineError({
  code: "FORBIDDEN",
  httpStatus: 403,
  message: "Caller lacks required permission.",
  retryable: false,
  category: "protocol",
});

const BackendUnavailableErrorBase = defineError({
  code: "BACKEND_UNAVAILABLE",
  httpStatus: 503,
  message: "A backend dependency is unavailable.",
  retryable: true,
  category: "service",
});

/** @deprecated Use defineError({ code, httpStatus, message, retryable }) for domain-specific errors. */
export class DomainError extends Error implements OpenCallErrorInstance {
  static readonly __opencall = true as const;
  static readonly code = "DOMAIN_ERROR";
  static readonly httpStatus = 200;
  static readonly defaultMessage = "Domain error";
  static readonly retryable = false;
  static readonly category = "domain" as const;

  public readonly code: string;
  public readonly httpStatus = 200;
  public readonly retryable = false;
  public readonly category = "domain" as const;

  constructor(code: string, message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "DomainError";
    this.code = code;
  }

  toJSON(): SerializedOpenCallError {
    return {
      code: this.code,
      category: this.category,
      httpStatus: this.httpStatus,
      retryable: this.retryable,
      message: this.message,
      ...(this.cause !== undefined && { cause: serializeCause(this.cause) }),
    };
  }

  toLog(): SerializedOpenCallError & { stack?: string } {
    return { ...this.toJSON(), stack: this.stack };
  }
}

/** @deprecated Use BackendUnavailableError(cause) or define a service-specific error with defineError(). */
export class BackendUnavailableError
  extends BackendUnavailableErrorBase
  implements OpenCallErrorInstance
{
  public readonly service?: string;
  public readonly retriable = true;

  constructor(cause?: unknown);
  constructor(service: string, message: string, cause?: unknown);
  constructor(serviceOrCause?: string | unknown, message?: string, cause?: unknown) {
    if (typeof serviceOrCause === "string") {
      super(cause);
      this.message = message ?? BackendUnavailableError.defaultMessage;
      this.service = serviceOrCause;
    } else {
      super(serviceOrCause);
    }
  }
}

export const InternalError = defineError({
  code: "INTERNAL_ERROR",
  httpStatus: 500,
  message: "Unexpected internal error.",
  retryable: false,
  category: "service",
});
