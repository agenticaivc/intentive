import { IntentCache, CachedIntentParser, CacheConfig } from '../src/cache';
import { ParsedIntent, ParseOptions } from '../src/types';
import { IntentParser } from '../src/IntentParser';

describe('IntentCache', () => {
  let cache: IntentCache;
  let config: CacheConfig;
  
  beforeEach(() => {
    config = { maxSize: 100, maxAge: 60000 }; // 1 minute
    cache = new IntentCache(config);
  });
  
  test('stores and retrieves cached results', () => {
    const mockResult: ParsedIntent = {
      primary: { graphId: 'test-graph', parameters: { key: 'value' }, confidence: 0.9 },
      alternatives: [],
      raw: 'test input',
      timestamp: new Date()
    };
    
    cache.set('test input', mockResult);
    const retrieved = cache.get('test input');
    
    expect(retrieved).toEqual(mockResult);
  });
  
  test('returns null for cache miss', () => {
    const result = cache.get('nonexistent input');
    expect(result).toBeNull();
  });
  
  test('handles different options as separate cache entries', () => {
    const mockResult1: ParsedIntent = {
      primary: { graphId: 'graph-1', parameters: {}, confidence: 0.8 },
      alternatives: [],
      raw: 'same input',
      timestamp: new Date()
    };
    
    const mockResult2: ParsedIntent = {
      primary: { graphId: 'graph-2', parameters: {}, confidence: 0.7 },
      alternatives: [],
      raw: 'same input',
      timestamp: new Date()
    };
    
    const options1: ParseOptions = { maxAlternatives: 1 };
    const options2: ParseOptions = { maxAlternatives: 2 };
    
    cache.set('same input', mockResult1, options1);
    cache.set('same input', mockResult2, options2);
    
    expect(cache.get('same input', options1)).toEqual(mockResult1);
    expect(cache.get('same input', options2)).toEqual(mockResult2);
  });
  
  test('hashes long cache keys to avoid size limits', () => {
    const longText = 'a'.repeat(1000); // Very long input
    const mockResult: ParsedIntent = {
      primary: { graphId: 'test-graph', parameters: {}, confidence: 0.9 },
      alternatives: [],
      raw: longText,
      timestamp: new Date()
    };
    
    cache.set(longText, mockResult);
    const retrieved = cache.get(longText);
    
    expect(retrieved).toEqual(mockResult);
  });
  
  test('case insensitive and trims whitespace in cache keys', () => {
    const mockResult: ParsedIntent = {
      primary: { graphId: 'test-graph', parameters: {}, confidence: 0.9 },
      alternatives: [],
      raw: 'Test Input',
      timestamp: new Date()
    };
    
    cache.set('  Test Input  ', mockResult);
    
    // Should find with different casing and whitespace
    expect(cache.get('test input')).toEqual(mockResult);
    expect(cache.get(' TEST INPUT ')).toEqual(mockResult);
  });
  
  test('respects cache expiration', async () => {
    const shortConfig: CacheConfig = { maxSize: 100, maxAge: 100 }; // 100ms
    const shortCache = new IntentCache(shortConfig);
    
    const mockResult: ParsedIntent = {
      primary: { graphId: 'test-graph', parameters: {}, confidence: 0.9 },
      alternatives: [],
      raw: 'test input',
      timestamp: new Date()
    };
    
    shortCache.set('test input', mockResult);
    
    // Should be available immediately
    expect(shortCache.get('test input')).toEqual(mockResult);
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Should be expired
    expect(shortCache.get('test input')).toBeNull();
  });
  
  test('clear() empties the cache', () => {
    const mockResult: ParsedIntent = {
      primary: { graphId: 'test-graph', parameters: {}, confidence: 0.9 },
      alternatives: [],
      raw: 'test input',
      timestamp: new Date()
    };
    
    cache.set('test input', mockResult);
    expect(cache.size()).toBe(1);
    
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('test input')).toBeNull();
  });
  
  test('size() returns correct cache size', () => {
    expect(cache.size()).toBe(0);
    
    const mockResult: ParsedIntent = {
      primary: { graphId: 'test-graph', parameters: {}, confidence: 0.9 },
      alternatives: [],
      raw: 'test input',
      timestamp: new Date()
    };
    
    cache.set('input1', mockResult);
    expect(cache.size()).toBe(1);
    
    cache.set('input2', mockResult);
    expect(cache.size()).toBe(2);
  });
});

describe('CachedIntentParser', () => {
  let cachedParser: CachedIntentParser;
  let mockBaseParser: jest.Mocked<IntentParser>;
  let cache: IntentCache;
  
  beforeEach(() => {
    mockBaseParser = {
      name: 'mock-parser',
      version: '1.0.0',
      parse: jest.fn()
    };
    cache = new IntentCache({ maxSize: 100, maxAge: 60000 });
    cachedParser = new CachedIntentParser(mockBaseParser, cache);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('cache hit prevents duplicate calls to base parser', async () => {
    const mockResult: ParsedIntent = {
      primary: { graphId: 'test-graph', parameters: {}, confidence: 0.9 },
      alternatives: [],
      raw: 'test input',
      timestamp: new Date()
    };
    
    mockBaseParser.parse.mockResolvedValue(mockResult);
    
    // First call - should hit base parser
    const result1 = await cachedParser.parse('test input');
    expect(result1).toEqual(mockResult);
    expect(mockBaseParser.parse).toHaveBeenCalledTimes(1);
    
    // Second call - should use cache
    const result2 = await cachedParser.parse('test input');
    expect(result2).toEqual(mockResult);
    expect(mockBaseParser.parse).toHaveBeenCalledTimes(1); // Still only 1 call
  });
  
  test('different options bypass cache', async () => {
    const mockResult: ParsedIntent = {
      primary: { graphId: 'test-graph', parameters: {}, confidence: 0.9 },
      alternatives: [],
      raw: 'test input',
      timestamp: new Date()
    };
    
    mockBaseParser.parse.mockResolvedValue(mockResult);
    
    await cachedParser.parse('test input', { maxAlternatives: 1 });
    await cachedParser.parse('test input', { maxAlternatives: 2 });
    
    expect(mockBaseParser.parse).toHaveBeenCalledTimes(2);
  });
  
  test('useCache: false bypasses cache completely', async () => {
    const mockResult: ParsedIntent = {
      primary: { graphId: 'test-graph', parameters: {}, confidence: 0.9 },
      alternatives: [],
      raw: 'test input',
      timestamp: new Date()
    };
    
    mockBaseParser.parse.mockResolvedValue(mockResult);
    
    // First call with cache disabled
    await cachedParser.parse('test input', { useCache: false });
    expect(mockBaseParser.parse).toHaveBeenCalledTimes(1);
    
    // Second call with cache disabled - should still call base parser
    await cachedParser.parse('test input', { useCache: false });
    expect(mockBaseParser.parse).toHaveBeenCalledTimes(2);
    
    // Third call with cache enabled - should still call base parser (nothing was cached)
    await cachedParser.parse('test input');
    expect(mockBaseParser.parse).toHaveBeenCalledTimes(3);
  });
  
  test('caches results when useCache is not explicitly disabled', async () => {
    const mockResult: ParsedIntent = {
      primary: { graphId: 'test-graph', parameters: {}, confidence: 0.9 },
      alternatives: [],
      raw: 'test input',
      timestamp: new Date()
    };
    
    mockBaseParser.parse.mockResolvedValue(mockResult);
    
    // First call - should cache the result
    await cachedParser.parse('test input', { maxAlternatives: 3 });
    expect(mockBaseParser.parse).toHaveBeenCalledTimes(1);
    
    // Second call with same options - should use cache
    await cachedParser.parse('test input', { maxAlternatives: 3 });
    expect(mockBaseParser.parse).toHaveBeenCalledTimes(1);
  });
  
  test('propagates errors from base parser', async () => {
    const error = new Error('Base parser error');
    mockBaseParser.parse.mockRejectedValue(error);
    
    await expect(cachedParser.parse('test input')).rejects.toThrow('Base parser error');
    expect(mockBaseParser.parse).toHaveBeenCalledTimes(1);
  });
  
  test('has correct name and version', () => {
    expect(cachedParser.name).toBe('cached-mock-parser');
    expect(cachedParser.version).toBe('1.0.0');
  });
  
  test('handles concurrent requests for same input', async () => {
    const mockResult: ParsedIntent = {
      primary: { graphId: 'test-graph', parameters: {}, confidence: 0.9 },
      alternatives: [],
      raw: 'test input',
      timestamp: new Date()
    };
    
    // Add delay to simulate slow parser
    mockBaseParser.parse.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockResult), 100))
    );
    
    // Make concurrent requests
    const promises = [
      cachedParser.parse('test input'),
      cachedParser.parse('test input'),
      cachedParser.parse('test input')
    ];
    
    const results = await Promise.all(promises);
    
    // All should return the same result
    results.forEach(result => expect(result).toEqual(mockResult));
    
    // Base parser should have been called multiple times (no request deduplication)
    // This is expected behavior - request deduplication would be a separate feature
    expect(mockBaseParser.parse).toHaveBeenCalledTimes(3);
  });
}); 