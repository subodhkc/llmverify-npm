/**
 * llmverify Error Classes
 * 
 * Custom error types for clear error handling.
 * 
 * @module errors
 * @author Haiec
 * @license MIT
 */

import { ErrorCode, ErrorMetadata, getErrorMetadata } from './errors/codes';

/**
 * Base error class for llmverify
 */
export class LLMVerifyError extends Error {
  public readonly code?: ErrorCode;
  public readonly metadata?: ErrorMetadata;
  public readonly requestId?: string;
  
  constructor(message: string, code?: ErrorCode, details?: any, requestId?: string) {
    super(message);
    this.name = 'LLMVerifyError';
    this.code = code;
    this.requestId = requestId;
    
    if (code) {
      this.metadata = getErrorMetadata(code, details, requestId);
    }
    
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      metadata: this.metadata,
      stack: this.stack
    };
  }
}

/**
 * Privacy violation error
 */
export class PrivacyViolationError extends LLMVerifyError {
  constructor(message: string, details?: any, requestId?: string) {
    super(message, ErrorCode.PRIVACY_VIOLATION, details, requestId);
    this.name = 'PrivacyViolationError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends LLMVerifyError {
  constructor(message: string, code?: ErrorCode, details?: any, requestId?: string) {
    super(message, code || ErrorCode.INVALID_INPUT, details, requestId);
    this.name = 'ValidationError';
  }
}

/**
 * Verification error
 */
export class VerificationError extends LLMVerifyError {
  constructor(message: string, code?: ErrorCode, details?: any, requestId?: string) {
    super(message, code || ErrorCode.ENGINE_FAILURE, details, requestId);
    this.name = 'VerificationError';
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends LLMVerifyError {
  constructor(message: string, code?: ErrorCode, details?: any, requestId?: string) {
    super(message, code || ErrorCode.INVALID_CONFIG, details, requestId);
    this.name = 'ConfigurationError';
  }
}

/**
 * Audit persistence error
 *
 * Thrown when the caller requires durable audit persistence
 * (evidence-required mode) and the write fails. Never thrown by
 * default — developer mode records the failure as a status instead.
 */
export class AuditPersistenceError extends LLMVerifyError {
  constructor(message: string, details?: any, requestId?: string) {
    super(message, ErrorCode.AUDIT_PERSISTENCE_FAILED, details, requestId);
    this.name = 'AuditPersistenceError';
  }
}

/**
 * Engine error
 */
export class EngineError extends LLMVerifyError {
  public readonly engineName: string;
  
  constructor(engineName: string, message: string, details?: any, requestId?: string) {
    super(`[${engineName}] ${message}`, ErrorCode.ENGINE_FAILURE, { ...details, engineName }, requestId);
    this.name = 'EngineError';
    this.engineName = engineName;
  }
}
