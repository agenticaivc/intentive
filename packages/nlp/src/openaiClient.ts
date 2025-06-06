import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';
import pino from 'pino';
import { NlpError } from './errors';
import { IntentResult, ExtractIntentResult, ExtractIntentOptions, TokenUsage } from './types';
import { config } from './config';

/**
 * Create child logger for NLP operations
 */
const logger = pino().child({ module: 'nlp' });

/**
 * Load and prepare the prompt template
 */
const promptTemplate = readFileSync(
  join(__dirname, '../prompts/intent-extract.txt'), 
  'utf-8'
);

/**
 * OpenAI client wrapper for intent extraction
 */
export class OpenAIClient {
  private client: OpenAI;

  constructor() {
    // Use verified OpenAI SDK initialization pattern
    this.client = new OpenAI({
      apiKey: config.apiKey,
      maxRetries: config.maxRetries,
    });
  }

  /**
   * Extract intent from user input text
   * Implements exponential backoff retry logic and proper error mapping
   */
  async extractIntent(
    ask: string, 
    options: ExtractIntentOptions = {}
  ): Promise<ExtractIntentResult> {
    if (!ask || ask.trim().length === 0) {
      throw new NlpError('Input text cannot be empty', 'VALIDATION');
    }

    const prompt = promptTemplate.replace('{USER_INPUT}', ask.trim());
    
    const requestLogger = logger.child({ 
      method: 'extractIntent',
      model: config.model,
      inputLength: ask.length 
    });

    // Mock environment for testing (only when explicitly enabled)
    if (process.env.FORCE_429 && process.env.NODE_ENV !== 'test') {
      const retryCount = parseInt(process.env.FORCE_429, 10);
      if (retryCount > 0) {
        requestLogger.info({ mockRetries: retryCount }, 'Forcing 429 errors for testing');
        for (let i = 0; i < retryCount; i++) {
          const mockError = Object.assign(new Error('Rate limit exceeded (mock)'), {
            status: 429,
            code: 'rate_limit_exceeded',
            request_id: `mock-req-${i}`,
          });
          Object.setPrototypeOf(mockError, OpenAI.APIError.prototype);
          
          if (i < retryCount - 1) {
            // Retry logic
            const delay = Math.min(config.retryDelay * Math.pow(2, i), 5000);
            requestLogger.info({ delay, attempt: i + 1 }, 'Mock rate limited, retrying after delay');
            await this.sleep(delay);
            continue;
          } else {
            // Last retry - throw final error
            throw new NlpError('Rate limit exceeded', 'RATE_LIMIT', 429, mockError);
          }
        }
      }
    }

    if (process.env.FORCE_500 && process.env.NODE_ENV !== 'test') {
      const mockError = Object.assign(new Error('Internal server error (mock)'), {
        status: 500,
        code: 'internal_server_error',
        request_id: 'mock-req-500',
      });
      Object.setPrototypeOf(mockError, OpenAI.APIError.prototype);
      throw new NlpError('OpenAI service unavailable', 'UNAVAILABLE', 500, mockError);
    }

    let lastError: Error | null = null;
    
    // Implement retry logic with exponential backoff
    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      try {
        requestLogger.debug({ attempt }, 'Attempting OpenAI request');

        // Use verified OpenAI SDK chat completions interface
        const completion = await this.client.chat.completions.create({
          model: config.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: options.temperature ?? config.temperature,
          max_tokens: options.maxTokens ?? 150,
        }, {
          // Put timeout in options object as per verified SDK interface
          timeout: options.timeout ?? 30000,
        });

        // Extract and validate response
        const response = completion.choices[0]?.message?.content;
        if (!response) {
          throw new NlpError('Empty response from OpenAI', 'UNKNOWN');
        }

        // Parse JSON response
        let intentResult: IntentResult;
        try {
          intentResult = JSON.parse(response.trim());
        } catch (parseError) {
          requestLogger.error({ response, parseError }, 'Failed to parse OpenAI response');
          throw new NlpError('Invalid JSON response from OpenAI', 'UNKNOWN', undefined, parseError as Error);
        }

        // Validate response structure
        if (!intentResult.graphId || typeof intentResult.graphId !== 'string') {
          throw new NlpError('Invalid response: missing or invalid graphId', 'VALIDATION');
        }

        if (!intentResult.parameters || typeof intentResult.parameters !== 'object') {
          throw new NlpError('Invalid response: missing or invalid parameters', 'VALIDATION');
        }

        // Extract token usage information (verified from SDK docs)
        const usage: TokenUsage = {
          promptTokens: completion.usage?.prompt_tokens ?? 0,
          completionTokens: completion.usage?.completion_tokens ?? 0,
          totalTokens: completion.usage?.total_tokens ?? 0,
        };

        // Log successful request with token usage
        requestLogger.info({
          usage,
          requestId: completion._request_id ?? undefined,
          graphId: intentResult.graphId,
          attempt,
        }, 'Intent extraction successful');

        return {
          result: intentResult,
          usage,
          requestId: completion._request_id ?? undefined,
        };

      } catch (error) {
        lastError = error as Error;
        
        // If it's already an NlpError, just re-throw it (don't wrap it)
        if (error instanceof NlpError) {
          throw error;
        }
        
        // Map OpenAI API errors to NlpError (verified error handling pattern)
        if (error instanceof OpenAI.APIError) {
          const apiError = error;
          
          requestLogger.warn({
            attempt,
            status: apiError.status,
            code: apiError.code,
            requestId: apiError.request_id,
          }, 'OpenAI API error occurred');

          // Handle rate limiting (429) - verified from SDK docs
          if (apiError.status === 429) {
            if (attempt <= config.maxRetries) {
              const delay = Math.min(config.retryDelay * Math.pow(2, attempt - 1), 5000);
              requestLogger.info({ delay, attempt }, 'Rate limited, retrying after delay');
              await this.sleep(delay);
              continue;
            } else {
              throw new NlpError('Rate limit exceeded', 'RATE_LIMIT', 429, apiError);
            }
          }

          // Handle server errors (5xx) - verified from SDK docs
          if (apiError.status >= 500) {
            if (attempt <= config.maxRetries) {
              const delay = Math.min(config.retryDelay * Math.pow(2, attempt - 1), 5000);
              requestLogger.info({ delay, attempt }, 'Server error, retrying after delay');
              await this.sleep(delay);
              continue;
            } else {
              throw new NlpError('OpenAI service unavailable', 'UNAVAILABLE', apiError.status, apiError);
            }
          }

          // Handle client errors (4xx) - no retry
          throw new NlpError(`OpenAI API error: ${apiError.message}`, 'VALIDATION', apiError.status, apiError);
        }

        // Handle connection/timeout errors
        if (error instanceof Error && (
          error.message.includes('timeout') || 
          error.message.includes('ECONNRESET') ||
          error.message.includes('ENOTFOUND')
        )) {
          if (attempt <= config.maxRetries) {
            const delay = Math.min(config.retryDelay * Math.pow(2, attempt - 1), 5000);
            requestLogger.info({ delay, attempt }, 'Connection error, retrying after delay');
            await this.sleep(delay);
            continue;
          } else {
            throw new NlpError('Connection to OpenAI failed', 'UNAVAILABLE', undefined, error);
          }
        }

        // Unknown error - no retry
        requestLogger.error({ error, attempt }, 'Unknown error occurred');
        throw new NlpError('Unknown error occurred', 'UNKNOWN', undefined, error as Error);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new NlpError('Maximum retries exceeded', 'UNAVAILABLE', undefined, lastError ?? undefined);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 