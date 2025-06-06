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

// ========================================
// Enhanced Parser Configuration (v0.1)
// ========================================

export interface NLPConfig {
  parser: {
    provider: 'openai' | 'local' | 'rule-based';
    openai: {
      model: string;
      temperature: number;
      maxTokens: number;
    };
    defaults: {
      minConfidence: number;
      maxAlternatives: number;
      useCache: boolean;
    };
  };
  cache: {
    maxSize: number;
    maxAge: number; // milliseconds
  };
  availableGraphIds: string[];
}

export const enhancedConfig: NLPConfig = {
  parser: {
    provider: 'openai',
    openai: {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000', 10)
    },
    defaults: {
      minConfidence: parseFloat(process.env.PARSER_MIN_CONFIDENCE || '0.5'),
      maxAlternatives: parseInt(process.env.PARSER_MAX_ALTERNATIVES || '3', 10),
      useCache: process.env.PARSER_USE_CACHE !== 'false'
    }
  },
  cache: {
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
    maxAge: parseInt(process.env.CACHE_MAX_AGE || '1800000', 10) // 30 minutes default
  },
  availableGraphIds: (process.env.AVAILABLE_GRAPH_IDS || 'payroll-processing,invoice-creation,user-management,report-generation').split(',')
}; 