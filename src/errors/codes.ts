/**
 * Error Codes for llmverify
 * 
 * Standardized error codes for consistent error handling
 * 
 * @module errors/codes
 */

/**
 * Error code enum
 */
export enum ErrorCode {
  // Input validation errors (1xxx)
  INVALID_INPUT = 'LLMVERIFY_1001',
  EMPTY_INPUT = 'LLMVERIFY_1002',
  CONTENT_TOO_LARGE = 'LLMVERIFY_1003',
  INVALID_FORMAT = 'LLMVERIFY_1004',
  INVALID_ENCODING = 'LLMVERIFY_1005',
  
  // Configuration errors (2xxx)
  MALFORMED_CONFIG = 'LLMVERIFY_2001',
  INVALID_CONFIG = 'LLMVERIFY_2002',
  CONFIG_NOT_FOUND = 'LLMVERIFY_2003',
  INVALID_TIER = 'LLMVERIFY_2004',
  
  // Runtime errors (3xxx)
  TIMEOUT = 'LLMVERIFY_3001',
  ENGINE_FAILURE = 'LLMVERIFY_3002',
  RESOURCE_EXHAUSTED = 'LLMVERIFY_3003',
  INTERNAL_ERROR = 'LLMVERIFY_3004',
  
  // Server errors (4xxx)
  PORT_IN_USE = 'LLMVERIFY_4001',
  SERVER_START_FAILED = 'LLMVERIFY_4002',
  INVALID_REQUEST = 'LLMVERIFY_4003',
  RATE_LIMIT_EXCEEDED = 'LLMVERIFY_4004',
  
  // Privacy/Security errors (5xxx)
  PRIVACY_VIOLATION = 'LLMVERIFY_5001',
  UNAUTHORIZED = 'LLMVERIFY_5002',
  FORBIDDEN = 'LLMVERIFY_5003',
  
  // Plugin errors (6xxx)
  PLUGIN_NOT_FOUND = 'LLMVERIFY_6001',
  PLUGIN_LOAD_FAILED = 'LLMVERIFY_6002',
  PLUGIN_EXECUTION_FAILED = 'LLMVERIFY_6003',
  INVALID_PLUGIN = 'LLMVERIFY_6004',
  
  // Usage/Tier errors (7xxx)
  USAGE_LIMIT_EXCEEDED = 'LLMVERIFY_7001',
  CONTENT_LENGTH_EXCEEDED = 'LLMVERIFY_7002'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error metadata interface
 */
export interface ErrorMetadata {
  code: ErrorCode;
  severity: ErrorSeverity;
  message: string;
  details?: any;
  timestamp: string;
  requestId?: string;
  recoverable: boolean;
  suggestion?: string;
}

/**
 * Error code metadata mapping
 */
export const ERROR_METADATA: Record<ErrorCode, Omit<ErrorMetadata, 'timestamp' | 'requestId' | 'details'>> = {
  // Input validation
  [ErrorCode.INVALID_INPUT]: {
    code: ErrorCode.INVALID_INPUT,
    severity: ErrorSeverity.MEDIUM,
    message: 'Invalid input provided',
    recoverable: true,
    suggestion: 'Check input format and try again'
  },
  [ErrorCode.EMPTY_INPUT]: {
    code: ErrorCode.EMPTY_INPUT,
    severity: ErrorSeverity.MEDIUM,
    message: 'Input content is empty',
    recoverable: true,
    suggestion: 'Provide non-empty content to verify'
  },
  [ErrorCode.CONTENT_TOO_LARGE]: {
    code: ErrorCode.CONTENT_TOO_LARGE,
    severity: ErrorSeverity.MEDIUM,
    message: 'Content exceeds maximum allowed size',
    recoverable: true,
    suggestion: 'Reduce content size or split into smaller chunks'
  },
  [ErrorCode.INVALID_FORMAT]: {
    code: ErrorCode.INVALID_FORMAT,
    severity: ErrorSeverity.MEDIUM,
    message: 'Invalid content format',
    recoverable: true,
    suggestion: 'Ensure content is in the expected format'
  },
  [ErrorCode.INVALID_ENCODING]: {
    code: ErrorCode.INVALID_ENCODING,
    severity: ErrorSeverity.MEDIUM,
    message: 'Invalid character encoding',
    recoverable: true,
    suggestion: 'Use UTF-8 encoding'
  },
  
  // Configuration
  [ErrorCode.MALFORMED_CONFIG]: {
    code: ErrorCode.MALFORMED_CONFIG,
    severity: ErrorSeverity.HIGH,
    message: 'Configuration file is malformed',
    recoverable: true,
    suggestion: 'Check JSON syntax in config file'
  },
  [ErrorCode.INVALID_CONFIG]: {
    code: ErrorCode.INVALID_CONFIG,
    severity: ErrorSeverity.HIGH,
    message: 'Invalid configuration values',
    recoverable: true,
    suggestion: 'Review configuration documentation'
  },
  [ErrorCode.CONFIG_NOT_FOUND]: {
    code: ErrorCode.CONFIG_NOT_FOUND,
    severity: ErrorSeverity.LOW,
    message: 'Configuration file not found',
    recoverable: true,
    suggestion: 'Run "npx llmverify init" to create default config'
  },
  [ErrorCode.INVALID_TIER]: {
    code: ErrorCode.INVALID_TIER,
    severity: ErrorSeverity.MEDIUM,
    message: 'Invalid tier specified',
    recoverable: true,
    suggestion: 'Use: free, starter, pro, or business'
  },
  
  // Runtime
  [ErrorCode.TIMEOUT]: {
    code: ErrorCode.TIMEOUT,
    severity: ErrorSeverity.HIGH,
    message: 'Operation timed out',
    recoverable: true,
    suggestion: 'Increase timeout or reduce content size'
  },
  [ErrorCode.ENGINE_FAILURE]: {
    code: ErrorCode.ENGINE_FAILURE,
    severity: ErrorSeverity.HIGH,
    message: 'Verification engine failed',
    recoverable: true,
    suggestion: 'Try again or disable the failing engine'
  },
  [ErrorCode.RESOURCE_EXHAUSTED]: {
    code: ErrorCode.RESOURCE_EXHAUSTED,
    severity: ErrorSeverity.CRITICAL,
    message: 'System resources exhausted',
    recoverable: false,
    suggestion: 'Reduce load or increase system resources'
  },
  [ErrorCode.INTERNAL_ERROR]: {
    code: ErrorCode.INTERNAL_ERROR,
    severity: ErrorSeverity.CRITICAL,
    message: 'Internal error occurred',
    recoverable: false,
    suggestion: 'Report this issue with error details'
  },
  
  // Server
  [ErrorCode.PORT_IN_USE]: {
    code: ErrorCode.PORT_IN_USE,
    severity: ErrorSeverity.HIGH,
    message: 'Port is already in use',
    recoverable: true,
    suggestion: 'Use a different port with --port flag'
  },
  [ErrorCode.SERVER_START_FAILED]: {
    code: ErrorCode.SERVER_START_FAILED,
    severity: ErrorSeverity.CRITICAL,
    message: 'Failed to start server',
    recoverable: false,
    suggestion: 'Check logs for details'
  },
  [ErrorCode.INVALID_REQUEST]: {
    code: ErrorCode.INVALID_REQUEST,
    severity: ErrorSeverity.MEDIUM,
    message: 'Invalid request format',
    recoverable: true,
    suggestion: 'Check API documentation'
  },
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    severity: ErrorSeverity.MEDIUM,
    message: 'Rate limit exceeded',
    recoverable: true,
    suggestion: 'Wait before making more requests'
  },
  
  // Privacy/Security
  [ErrorCode.PRIVACY_VIOLATION]: {
    code: ErrorCode.PRIVACY_VIOLATION,
    severity: ErrorSeverity.CRITICAL,
    message: 'Privacy policy violation detected',
    recoverable: false,
    suggestion: 'Review privacy settings'
  },
  [ErrorCode.UNAUTHORIZED]: {
    code: ErrorCode.UNAUTHORIZED,
    severity: ErrorSeverity.HIGH,
    message: 'Unauthorized access',
    recoverable: true,
    suggestion: 'Provide valid API key'
  },
  [ErrorCode.FORBIDDEN]: {
    code: ErrorCode.FORBIDDEN,
    severity: ErrorSeverity.HIGH,
    message: 'Access forbidden',
    recoverable: false,
    suggestion: 'Upgrade tier for this feature'
  },
  
  // Plugins
  [ErrorCode.PLUGIN_NOT_FOUND]: {
    code: ErrorCode.PLUGIN_NOT_FOUND,
    severity: ErrorSeverity.MEDIUM,
    message: 'Plugin not found',
    recoverable: true,
    suggestion: 'Check plugin ID and registration'
  },
  [ErrorCode.PLUGIN_LOAD_FAILED]: {
    code: ErrorCode.PLUGIN_LOAD_FAILED,
    severity: ErrorSeverity.HIGH,
    message: 'Failed to load plugin',
    recoverable: true,
    suggestion: 'Check plugin compatibility'
  },
  [ErrorCode.PLUGIN_EXECUTION_FAILED]: {
    code: ErrorCode.PLUGIN_EXECUTION_FAILED,
    severity: ErrorSeverity.MEDIUM,
    message: 'Plugin execution failed',
    recoverable: true,
    suggestion: 'Check plugin implementation'
  },
  [ErrorCode.INVALID_PLUGIN]: {
    code: ErrorCode.INVALID_PLUGIN,
    severity: ErrorSeverity.HIGH,
    message: 'Invalid plugin structure',
    recoverable: true,
    suggestion: 'Ensure plugin implements required interface'
  },
  
  // Usage/Tier
  [ErrorCode.USAGE_LIMIT_EXCEEDED]: {
    code: ErrorCode.USAGE_LIMIT_EXCEEDED,
    severity: ErrorSeverity.MEDIUM,
    message: 'Daily usage limit exceeded for your tier',
    recoverable: true,
    suggestion: 'Upgrade your plan at https://haiec.com/llmverify/pricing or wait until tomorrow'
  },
  [ErrorCode.CONTENT_LENGTH_EXCEEDED]: {
    code: ErrorCode.CONTENT_LENGTH_EXCEEDED,
    severity: ErrorSeverity.MEDIUM,
    message: 'Content exceeds tier size limit',
    recoverable: true,
    suggestion: 'Reduce content size or upgrade your plan at https://haiec.com/llmverify/pricing'
  }
};

/**
 * Get error metadata
 */
export function getErrorMetadata(code: ErrorCode, details?: any, requestId?: string): ErrorMetadata {
  const base = ERROR_METADATA[code];
  return {
    ...base,
    timestamp: new Date().toISOString(),
    requestId,
    details
  };
}

/**
 * Check if error is recoverable
 */
export function isRecoverable(code: ErrorCode): boolean {
  return ERROR_METADATA[code].recoverable;
}

/**
 * Get error suggestion
 */
export function getErrorSuggestion(code: ErrorCode): string | undefined {
  return ERROR_METADATA[code].suggestion;
}
