/**
 * @intentive/nlp - OpenAI NLP Integration Package
 * 
 * Provides intent extraction capabilities using OpenAI's Chat Completion API
 */

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