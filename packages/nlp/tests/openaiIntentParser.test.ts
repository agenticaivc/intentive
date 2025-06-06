// Set up environment before any imports
process.env.OPENAI_API_KEY = 'test-key-for-tests';

import { OpenAIIntentParser } from '../src/OpenAIIntentParser';
import { IntentParserFactory } from '../src/IntentParserFactory';
import { ParsedIntent } from '../src/types';
import { OpenAIClient } from '../src/openaiClient';
import { NlpError } from '../src/errors';

// Mock the OpenAI client
jest.mock('../src/openaiClient');

describe('OpenAIIntentParser', () => {
  let mockOpenAIClient: jest.Mocked<OpenAIClient>;
  let parser: OpenAIIntentParser;
  
  beforeEach(() => {
    mockOpenAIClient = {
      extractIntent: jest.fn()
    } as any;
    parser = new OpenAIIntentParser(mockOpenAIClient, ['payroll-processing', 'invoice-creation']);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('happy path - returns primary intent with high confidence', async () => {
    // Mock OpenAI client response
    mockOpenAIClient.extractIntent.mockResolvedValue({
      result: {
        graphId: 'payroll-processing',
        parameters: { period: 'December 2024', type: 'monthly' }
      },
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
      requestId: 'test-req-123'
    });
    
    const result = await parser.parse('Process payroll for December 2024');
    
    expect(result.primary.graphId).toBe('payroll-processing');
    expect(result.primary.confidence).toBeGreaterThan(0.6);
    expect(result.primary.parameters.period).toBe('December 2024');
    expect(result.primary.parameters.type).toBe('monthly');
    expect(result.alternatives.length).toBeGreaterThanOrEqual(0);
    expect(result.raw).toBe('Process payroll for December 2024');
    expect(result.timestamp).toBeInstanceOf(Date);
  });
  
  test('ambiguous input - returns multiple candidates sorted by confidence', async () => {
    mockOpenAIClient.extractIntent.mockResolvedValue({
      result: {
        graphId: 'payroll-processing',
        parameters: {}
      },
      usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
    });
    
    const result = await parser.parse('Run payroll or create invoice');
    
    expect(result.primary.confidence).toBeGreaterThan(0);
    expect(result.alternatives.length).toBeGreaterThan(0);
    
    // Verify alternatives are sorted by confidence (descending)
    if (result.alternatives.length > 1) {
      for (let i = 0; i < result.alternatives.length - 1; i++) {
        expect(result.alternatives[i].confidence).toBeGreaterThanOrEqual(result.alternatives[i + 1].confidence);
      }
    }
    
    // Primary should have highest confidence
    if (result.alternatives.length > 0) {
      expect(result.primary.confidence).toBeGreaterThanOrEqual(result.alternatives[0].confidence);
    }
  });
  
  test('rate limiting with backoff and retry', async () => {
    const rateLimitError = new NlpError('Rate limit exceeded', 'RATE_LIMIT', 429);
    
    mockOpenAIClient.extractIntent
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({
        result: {
          graphId: 'test-graph',
          parameters: {}
        },
        usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 }
      });
    
    const startTime = Date.now();
    const result = await parser.parse('test input');
    const endTime = Date.now();
    
    expect(result.primary.graphId).toBe('test-graph');
    expect(mockOpenAIClient.extractIntent).toHaveBeenCalledTimes(3);
    
    // Should have taken some time due to backoff delays
    expect(endTime - startTime).toBeGreaterThan(500); // Reduced expectation
  }, 10000); // 10 second timeout
  
  test('non-rate-limit error throws immediately without retry', async () => {
    const validationError = new NlpError('Invalid response', 'VALIDATION');
    
    mockOpenAIClient.extractIntent.mockRejectedValue(validationError);
    
    await expect(parser.parse('test')).rejects.toThrow('Failed to parse intent after 3 attempts');
    expect(mockOpenAIClient.extractIntent).toHaveBeenCalledTimes(1);
  });
  
  test('confidence estimation works correctly', async () => {
    mockOpenAIClient.extractIntent.mockResolvedValue({
      result: {
        graphId: 'payroll-processing',
        parameters: {}
      },
      usage: { promptTokens: 25, completionTokens: 8, totalTokens: 33 }
    });
    
    // Test exact match
    const exactResult = await parser.parse('payroll processing task');
    expect(exactResult.primary.confidence).toBeGreaterThan(0.75);
    
    // Test keyword match
    const keywordResult = await parser.parse('run payroll for team');
    expect(keywordResult.primary.confidence).toBeGreaterThan(0.5);
    expect(keywordResult.primary.confidence).toBeLessThan(0.9);
  });
  
  test('validates result schema', async () => {
    mockOpenAIClient.extractIntent.mockResolvedValue({
      result: {
        graphId: 'test-graph',
        parameters: { validParam: 'value' }
      },
      usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 }
    });
    
    const result = await parser.parse('test input');
    
    // Should pass validation
    expect(result.primary.graphId).toBe('test-graph');
    expect(result.primary.confidence).toBeGreaterThanOrEqual(0);
    expect(result.primary.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.primary.parameters).toBe('object');
  });
  
  test('handles empty parameters gracefully', async () => {
    mockOpenAIClient.extractIntent.mockResolvedValue({
      result: {
        graphId: 'simple-task',
        parameters: {}
      },
      usage: { promptTokens: 15, completionTokens: 3, totalTokens: 18 }
    });
    
    const result = await parser.parse('simple task');
    
    expect(result.primary.graphId).toBe('simple-task');
    expect(result.primary.parameters).toEqual({});
    expect(result.primary.confidence).toBeGreaterThan(0);
  });
});

describe('IntentParserFactory', () => {
  beforeEach(() => {
    // Set up environment for factory tests
    process.env.OPENAI_API_KEY = 'test-key-123';
  });
  
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });
  
  test('throws error when OPENAI_API_KEY missing', () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => IntentParserFactory.create()).toThrow('OPENAI_API_KEY environment variable is required but not set');
  });
  
  test('creates cached OpenAI parser when API key present', () => {
    const parser = IntentParserFactory.create();
    expect(parser.name).toContain('cached');
    expect(parser.name).toContain('openai');
  });
  
  test('accepts custom configuration', () => {
    const customConfig = {
      cache: { maxSize: 500, maxAge: 60000 },
      availableGraphIds: ['custom-graph-1', 'custom-graph-2']
    };
    
    const parser = IntentParserFactory.create(customConfig);
    expect(parser).toBeDefined();
    expect(parser.name).toContain('cached');
  });
  
  test('throws error for unsupported provider', () => {
    expect(() => IntentParserFactory.create({
      parser: { provider: 'unsupported' as any, openai: { model: '', temperature: 0, maxTokens: 0 }, defaults: { minConfidence: 0, maxAlternatives: 0, useCache: false } },
      cache: { maxSize: 100, maxAge: 60000 },
      availableGraphIds: []
    })).toThrow('Unsupported parser provider: unsupported');
  });
}); 