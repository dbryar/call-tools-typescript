// Re-export the contract surface from @opencall/types so consumers of
// @opencall/server can import envelope types directly without a separate
// install of @opencall/types.
export {
  RequestEnvelopeSchema,
  type RequestEnvelope,
  type ResponseState,
  type ResponseEnvelope,
  AuthRequiredError,
  DomainError,
  BackendUnavailableError,
  ForbiddenError,
  InternalError,
  InvalidEnvelopeError,
  OpNotFoundError,
  OpRemovedError,
  SchemaValidationError,
  defineError,
  domainError,
  isOpenCallError,
  protocolError,
  type ErrorCategory,
  type ErrorEntry,
  type ErrorsResponse,
  type OpenCallErrorConstructor,
  type OpenCallErrorInstance,
  type OpenCallErrorMeta,
  type SerializedOpenCallError,
  type OperationResult,
  type OperationModule,
  type RegistryEntry,
  type RegistryResponse,
} from "@opencall/types"

// Server-only surface.
export { parseJSDoc } from "./jsdoc.js"

export { isDbConnectionError } from "./db-errors.js"

export {
  buildRegistry,
  buildRegistryFromModules,
  type BuildRegistryOptions,
  type BuildRegistryResult,
  type RuntimeAdapters,
  type ModuleEntry,
  type ModuleMeta,
} from "./registry.js"

export {
  generateOpsModule,
  type GenerateOpsOptions,
} from "./codegen.js"

export {
  buildErrorCatalog,
  buildErrorCatalogFromModules,
} from "./error-catalog.js"

export {
  validateEnvelope,
  validateArgs,
  checkSunset,
  formatResponse,
  safeHandlerCall,
  type DispatchResult,
} from "./validate.js"
