import { OpenAIClient } from '../src/openaiClient';
import { NlpError } from '../src/errors';
import OpenAI from 'openai';

// Mock OpenAI SDK
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

// Mock pino logger
jest.mock('pino', () => {
  const mockLogger: any = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn((): any => mockLogger),
  };
  return {
    __esModule: true,
    default: jest.fn(() => mockLogger),
  };
});

// Mock fs for prompt template
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => 'Mock prompt template {USER_INPUT}'),
}));

// Mock config
jest.mock('../src/config', () => ({
  config: {
    apiKey: 'test-api-key',
    model: 'gpt-4o-mini',
    temperature: 0.1,
    maxRetries: 3,
    retryDelay: 1000,
  },
}));

describe('OpenAIClient', () => {
  let client: OpenAIClient;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCreate = jest.fn();
    MockedOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    } as any));

    client = new OpenAIClient();
  });

  describe('extractIntent', () => {
    it('should successfully extract intent for payroll request', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"graphId": "payroll", "parameters": {"period": "2024-12"}}'
          }
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70,
        },
        _request_id: 'req-123',
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await client.extractIntent('Process payroll for December 2024');

      expect(result).toEqual({
        result: {
          graphId: 'payroll',
          parameters: { period: '2024-12' }
        },
        usage: {
          promptTokens: 50,
          completionTokens: 20,
          totalTokens: 70,
        },
        requestId: 'req-123',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Mock prompt template Process payroll for December 2024' }],
        temperature: 0.1,
        max_tokens: 150,
      }, {
        timeout: 30000,
      });
    });

    it('should successfully extract intent for minimal task', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"graphId": "minimal", "parameters": {}}'
          }
        }],
        usage: {
          prompt_tokens: 30,
          completion_tokens: 10,
          total_tokens: 40,
        },
        _request_id: 'req-456',
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await client.extractIntent('Execute basic task');

      expect(result.result).toEqual({
        graphId: 'minimal',
        parameters: {}
      });
    });

    it('should throw validation error for empty input', async () => {
      await expect(client.extractIntent('')).rejects.toThrow(
        new NlpError('Input text cannot be empty', 'VALIDATION')
      );

      await expect(client.extractIntent('   ')).rejects.toThrow(
        new NlpError('Input text cannot be empty', 'VALIDATION')
      );
    });

    it('should throw error for empty OpenAI response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null
          }
        }],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      };

      mockCreate.mockResolvedValue(mockResponse);

      await expect(client.extractIntent('test')).rejects.toThrow(
        new NlpError('Empty response from OpenAI', 'UNKNOWN')
      );
    });

    it('should throw error for invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'invalid json'
          }
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockCreate.mockResolvedValue(mockResponse);

      await expect(client.extractIntent('test')).rejects.toThrow(
        'Invalid JSON response from OpenAI'
      );
    });

    it('should throw validation error for missing graphId', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"parameters": {}}'
          }
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockCreate.mockResolvedValue(mockResponse);

      await expect(client.extractIntent('test')).rejects.toThrow(
        new NlpError('Invalid response: missing or invalid graphId', 'VALIDATION')
      );
    });

    it('should throw validation error for missing parameters', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"graphId": "test"}'
          }
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockCreate.mockResolvedValue(mockResponse);

      await expect(client.extractIntent('test')).rejects.toThrow(
        new NlpError('Invalid response: missing or invalid parameters', 'VALIDATION')
      );
    });

    it('should retry on 429 rate limit and succeed', async () => {
      // Create a mock error that looks like OpenAI.APIError
      const rateLimitError = Object.assign(new Error('Rate limit exceeded'), {
        status: 429,
        code: 'rate_limit_exceeded',
        request_id: 'req-123',
      });
      Object.setPrototypeOf(rateLimitError, OpenAI.APIError.prototype);

      const successResponse = {
        choices: [{
          message: {
            content: '{"graphId": "minimal", "parameters": {}}'
          }
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        _request_id: 'req-retry',
      };

      mockCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(successResponse);

      const result = await client.extractIntent('test');

      expect(result.result.graphId).toBe('minimal');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should throw rate limit error after max retries', async () => {
      const rateLimitError = Object.assign(new Error('Rate limit exceeded'), {
        status: 429,
        code: 'rate_limit_exceeded',
        request_id: 'req-123',
      });
      Object.setPrototypeOf(rateLimitError, OpenAI.APIError.prototype);

      mockCreate.mockRejectedValue(rateLimitError);

      await expect(client.extractIntent('test')).rejects.toThrow(
        new NlpError('Rate limit exceeded', 'RATE_LIMIT', 429)
      );

      expect(mockCreate).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    }, 15000); // Increase timeout to 15 seconds

    it('should retry on 500 server error and succeed', async () => {
      const serverError = Object.assign(new Error('Internal server error'), {
        status: 500,
        code: 'internal_server_error',
        request_id: 'req-123',
      });
      Object.setPrototypeOf(serverError, OpenAI.APIError.prototype);

      const successResponse = {
        choices: [{
          message: {
            content: '{"graphId": "minimal", "parameters": {}}'
          }
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockCreate
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce(successResponse);

      const result = await client.extractIntent('test');

      expect(result.result.graphId).toBe('minimal');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw unavailable error for persistent 500 errors', async () => {
      const serverError = Object.assign(new Error('Internal server error'), {
        status: 500,
        code: 'internal_server_error',
        request_id: 'req-123',
      });
      Object.setPrototypeOf(serverError, OpenAI.APIError.prototype);

      mockCreate.mockRejectedValue(serverError);

      await expect(client.extractIntent('test')).rejects.toThrow(
        new NlpError('OpenAI service unavailable', 'UNAVAILABLE', 500)
      );
    }, 15000); // Increase timeout to 15 seconds

    it('should not retry on 400 client errors', async () => {
      const clientError = Object.assign(new Error('Bad request'), {
        status: 400,
        code: 'bad_request',
        request_id: 'req-123',
      });
      Object.setPrototypeOf(clientError, OpenAI.APIError.prototype);

      mockCreate.mockRejectedValue(clientError);

      await expect(client.extractIntent('test')).rejects.toThrow(
        new NlpError('OpenAI API error: Bad request', 'VALIDATION', 400)
      );

      expect(mockCreate).toHaveBeenCalledTimes(1); // No retries for 4xx
    });

    it('should use custom options', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"graphId": "minimal", "parameters": {}}'
          }
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockCreate.mockResolvedValue(mockResponse);

      await client.extractIntent('test', {
        temperature: 0.5,
        maxTokens: 200,
        timeout: 60000,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Mock prompt template test' }],
        temperature: 0.5,
        max_tokens: 200,
      }, {
        timeout: 60000,
      });
    });
  });
}); 