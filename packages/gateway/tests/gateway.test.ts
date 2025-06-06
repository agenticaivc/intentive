// Setup required environment variables before imports
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-api-key';

import { build } from '../src/index';
import { isUUID } from 'validator';
import { FastifyInstance } from 'fastify';

describe('Gateway Integration', () => {
  let app: FastifyInstance;
  
  beforeAll(async () => {
    app = build({ logger: false });
    await app.ready();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  describe('GET /health', () => {
    test('returns 200 with status ok', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ status: 'ok' });
    });
    
    test('has correct content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });
      
      expect(response.headers['content-type']).toContain('application/json');
    });
  });
  
  describe('POST /intent', () => {
    test('returns 202 with valid UUID for valid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/intent',
        payload: { ask: 'hello world' }
      });
      
      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('executionId');
      expect(isUUID(body.executionId, 4)).toBe(true);
      // Intent field is optional (depends on OpenAI API success)
      if (body.intent) {
        expect(body.intent).toHaveProperty('graphId');
        expect(body.intent).toHaveProperty('parameters');
      }
    });
    
    test('rejects request with unknown fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/intent',
        payload: { ask: 'hello', extra: 'field' }
      });
      
      expect(response.statusCode).toBe(400);
    });
    
    test('rejects request with missing ask field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/intent',
        payload: {}
      });
      
      expect(response.statusCode).toBe(400);
    });
    
    test('rejects request with empty ask field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/intent',
        payload: { ask: '' }
      });
      
      expect(response.statusCode).toBe(400);
    });
    
    test('has correct content type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/intent',
        payload: { ask: 'test request' }
      });
      
      expect(response.headers['content-type']).toContain('application/json');
    });
  });
  
  describe('404 handling', () => {
    test('returns 404 for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/unknown'
      });
      
      expect(response.statusCode).toBe(404);
    });
  });
}); 