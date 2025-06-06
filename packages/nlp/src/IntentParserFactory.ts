import { IntentParser } from './IntentParser';
import { OpenAIIntentParser } from './OpenAIIntentParser';
import { CachedIntentParser, IntentCache } from './cache';
import { OpenAIClient } from './openaiClient';
import { NLPConfig, enhancedConfig } from './config';

/**
 * Factory for creating intent parsers
 */
export class IntentParserFactory {
  static create(config: Partial<NLPConfig> = {}): IntentParser {
    const fullConfig = { ...enhancedConfig, ...config };
    
    let baseParser: IntentParser;
    
    switch (fullConfig.parser.provider) {
      case 'openai':
        // Validate environment variable
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY environment variable is required but not set');
        }
        
        const openaiClient = new OpenAIClient();
        baseParser = new OpenAIIntentParser(openaiClient, fullConfig.availableGraphIds);
        break;
      default:
        throw new Error(`Unsupported parser provider: ${fullConfig.parser.provider}`);
    }
    
    // Wrap with cache
    const cache = new IntentCache(fullConfig.cache);
    return new CachedIntentParser(baseParser, cache);
  }
} 