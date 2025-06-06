/**
 * Successful intent extraction result
 */
export interface IntentResult {
  graphId: string;
  parameters: Record<string, unknown>;
}

/**
 * Error result for failed intent extraction
 */
export interface NlpErrorResult {
  error: string;
  type?: 'RATE_LIMIT' | 'UNAVAILABLE';
}

/**
 * Token usage information from OpenAI API
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Extended result with token usage and metadata
 */
export interface ExtractIntentResult {
  result: IntentResult;
  usage: TokenUsage;
  requestId?: string;
}

/**
 * Configuration for the OpenAI client
 */
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Options for the extractIntent method
 */
export interface ExtractIntentOptions {
  /** Custom temperature for this request */
  temperature?: number;
  /** Custom max tokens for this request */
  maxTokens?: number;
  /** Custom timeout in milliseconds */
  timeout?: number;
} 