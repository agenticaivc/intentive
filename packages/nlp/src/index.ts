/**
 * @intentive/nlp - OpenAI NLP Integration Package
 * 
 * Provides intent extraction capabilities using OpenAI's Chat Completion API
 */

// Legacy exports (preserved for backward compatibility)
export { OpenAIClient } from './openaiClient';
export { NlpError } from './errors';
export { 
  IntentResult, 
  NlpErrorResult, 
  TokenUsage, 
  ExtractIntentResult,
  ExtractIntentOptions,
  OpenAIConfig 
} from './types';
export { config, validateConfig } from './config';

// Enhanced Intent Parser exports (v0.1)
export {
  IntentCandidate,
  ParsedIntent,
  ParseOptions,
  ParserError,
  intentCandidateSchema,
  parsedIntentSchema
} from './types';
export { IntentParser, BaseIntentParser } from './IntentParser';
export { OpenAIIntentParser } from './OpenAIIntentParser';
export { IntentCache, CachedIntentParser, CacheConfig } from './cache';
export { IntentParserFactory } from './IntentParserFactory';
export { NLPConfig, enhancedConfig } from './config'; 