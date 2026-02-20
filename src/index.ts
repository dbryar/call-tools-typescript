// Envelope schemas and types
export {
  RequestEnvelopeSchema,
  type RequestEnvelope,
  type ResponseState,
  type ResponseEnvelope,
} from "./envelope.js";

// Error handling
export { DomainError, domainError, protocolError } from "./errors.js";

// Core types
export type {
  OperationResult,
  OperationModule,
  RegistryEntry,
  RegistryResponse,
} from "./types.js";

// JSDoc parser
export { parseJSDoc } from "./jsdoc.js";

// Registry builder
export {
  buildRegistry,
  type BuildRegistryOptions,
  type BuildRegistryResult,
} from "./registry.js";

// Validation utilities
export {
  validateEnvelope,
  validateArgs,
  checkSunset,
  formatResponse,
  safeHandlerCall,
  type DispatchResult,
} from "./validate.js";
