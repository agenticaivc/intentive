/**
 * Custom error class for NLP operations
 * Maps OpenAI API errors to application-specific error types
 */
export class NlpError extends Error {
  constructor(
    message: string,
    public readonly type: 'RATE_LIMIT' | 'UNAVAILABLE' | 'VALIDATION' | 'UNKNOWN',
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'NlpError';
    
    // Maintain stack trace for V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NlpError);
    }
  }

  /**
   * Check if the error indicates a temporary failure that should be retried
   */
  get isRetryable(): boolean {
    return this.type === 'RATE_LIMIT' || this.type === 'UNAVAILABLE';
  }

  /**
   * Get a user-friendly error response object
   */
  toErrorResponse(): { error: string; type?: string } {
    switch (this.type) {
      case 'RATE_LIMIT':
        return { error: 'Temporary', type: 'RATE_LIMIT' };
      case 'UNAVAILABLE':
        return { error: 'Unavailable' };
      case 'VALIDATION':
        return { error: 'Invalid input provided' };
      default:
        return { error: 'Internal error occurred' };
    }
  }
} 