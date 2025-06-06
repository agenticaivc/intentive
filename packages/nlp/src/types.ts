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

// ========================================
// Enhanced Intent Parser Types (v0.1)
// ========================================

import { z } from 'zod';

/**
 * Enhanced intent candidate with confidence scoring
 */
export interface IntentCandidate {
  graphId: string;
  parameters: Record<string, string | number | boolean | Record<string, unknown>>;
  confidence: number; // 0-1 range
}

/**
 * Enhanced parsed intent result with alternatives
 */
export interface ParsedIntent {
  primary: IntentCandidate;
  alternatives: IntentCandidate[];
  raw: string;
  timestamp: Date;
}

/**
 * Options for the enhanced intent parser
 */
export interface ParseOptions {
  minConfidence?: number;
  maxAlternatives?: number;
  modelOverride?: string;
  useCache?: boolean;
}

/**
 * Enhanced parser error class
 */
export class ParserError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ParserError';
  }
}

// ========================================
// Validation Schemas
// ========================================

export const intentCandidateSchema = z.object({
  graphId: z.string().min(1, 'graphId cannot be empty'),
  parameters: z.record(z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.object({}).passthrough()
  ])),
  confidence: z.number().min(0).max(1, 'confidence must be between 0 and 1')
});

export const parsedIntentSchema = z.object({
  primary: intentCandidateSchema,
  alternatives: z.array(intentCandidateSchema),
  raw: z.string(),
  timestamp: z.date()
}); 