import QuickLRU from 'quick-lru';
import { createHash } from 'crypto';
import { ParsedIntent, ParseOptions } from './types';
import { IntentParser } from './IntentParser';

export interface CacheConfig {
  maxSize: number;
  maxAge: number; // milliseconds
}

/**
 * LRU cache for intent parsing results
 */
export class IntentCache {
  private cache: QuickLRU<string, { result: ParsedIntent; timestamp: number }>;
  
  constructor(private config: CacheConfig) {
    this.cache = new QuickLRU({
      maxSize: config.maxSize,
      maxAge: config.maxAge
    });
  }
  
  get(text: string, options?: ParseOptions): ParsedIntent | null {
    const key = this.buildCacheKey(text, options);
    const cached = this.cache.get(key);
    
    if (cached && this.isValidCacheEntry(cached)) {
      return cached.result;
    }
    
    return null;
  }
  
  set(text: string, result: ParsedIntent, options?: ParseOptions): void {
    const key = this.buildCacheKey(text, options);
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }
  
  private buildCacheKey(text: string, options?: ParseOptions): string {
    const optionsHash = options ? JSON.stringify(options) : '';
    const rawKey = `${text.toLowerCase().trim()}:${optionsHash}`;
    
    // Hash long keys to avoid LRU key size limits
    return createHash('sha256').update(rawKey).digest('base64url');
  }
  
  private isValidCacheEntry(entry: { result: ParsedIntent; timestamp: number }): boolean {
    const age = Date.now() - entry.timestamp;
    return age < this.config.maxAge;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

/**
 * Cached intent parser wrapper
 */
export class CachedIntentParser implements IntentParser {
  readonly name: string;
  readonly version: string;
  
  constructor(
    private parser: IntentParser,
    private cache: IntentCache
  ) {
    this.name = `cached-${parser.name}`;
    this.version = parser.version;
  }
  
  async parse(text: string, options: ParseOptions = {}): Promise<ParsedIntent> {
    if (options.useCache !== false) {
      const cached = this.cache.get(text, options);
      if (cached) {
        return cached;
      }
    }
    
    const result = await this.parser.parse(text, options);
    
    if (options.useCache !== false) {
      this.cache.set(text, result, options);
    }
    
    return result;
  }
} 