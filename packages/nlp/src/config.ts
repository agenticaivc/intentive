import dotenv from 'dotenv';
import { OpenAIConfig } from './types';

// Load environment variables
dotenv.config();

/**
 * Configuration for the OpenAI NLP client
 */
export const config: OpenAIConfig = {
  apiKey: process.env.OPENAI_API_KEY!,
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
  maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(process.env.OPENAI_RETRY_DELAY || '1000', 10),
};

/**
 * Validate the configuration
 * Throws an error if required environment variables are missing
 */
export function validateConfig(): void {
  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  if (config.temperature < 0 || config.temperature > 2) {
    throw new Error('OPENAI_TEMPERATURE must be between 0 and 2');
  }

  if (config.maxRetries < 0 || config.maxRetries > 10) {
    throw new Error('OPENAI_MAX_RETRIES must be between 0 and 10');
  }

  if (config.retryDelay < 0) {
    throw new Error('OPENAI_RETRY_DELAY must be non-negative');
  }
}

// Validate configuration on module load
validateConfig(); 