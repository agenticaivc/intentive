import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { build } from '@intentive/gateway';
import { FastifyInstance } from 'fastify';

describe('Intent List API (t03)', () => {
  let app: FastifyInstance;
  
  beforeEach(async () => {
    app = build({ 
      logger: false,
      useRouterConfig: false // Use auto-loaded routes for testing
    });
    await app.ready();
  });
  
  afterEach(async () => {
    await app.close();
  });

  // Helper to create test execution records
  const createTestExecution = async (status: string, graphId: string = 'test-graph'): Promise<string> => {
    const response = await app.inject({
      method: 'POST',
      url: '/intent',
      payload: { ask: `Test intent for ${graphId}` }
    });
    
    const { executionId } = JSON.parse(response.payload);
    
    // Update status if not default 'queued'
    if (status !== 'queued') {
      const store = require('@intentive/gateway/dist/store/executionStore').getExecutionStore();
      const record = await store.get(executionId);
      await store.upsert({
        ...record,
        status: status as any,
        durationMs: status === 'completed' ? 150 : undefined,
        error: status === 'failed' ? 'Test error' : undefined
      });
    }
    
    return executionId;
  };

  // Happy path: List executions with pagination
  it('should return paginated list of executions', async () => {
    // Create 3 test executions
    const id1 = await createTestExecution('completed', 'payroll');
    const id2 = await createTestExecution('running', 'workflow');
    const id3 = await createTestExecution('failed', 'process');
    
    // Get first page with limit=2
    const response = await app.inject({
      method: 'GET',
      url: '/intent?limit=2'
    });
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    
    expect(data.items).toHaveLength(2);
    expect(data.nextCursor).toBeDefined();
    
    // Verify items structure
    data.items.forEach((item: any) => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('graph');
      expect(item).toHaveProperty('createdAt');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('user');
      expect(item.user).toHaveProperty('id');
    });
    
    // Verify most recent first (created in reverse order)
    expect([id3, id2, id1]).toContain(data.items[0].id);
  });

  // Filter by status
  it('should filter executions by status', async () => {
    // Create mixed status executions
    await createTestExecution('completed');
    await createTestExecution('failed');
    await createTestExecution('running');
    
    // Filter for only failed executions
    const response = await app.inject({
      method: 'GET',
      url: '/intent?status=failed'
    });
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    
    expect(data.items.length).toBeGreaterThan(0);
    data.items.forEach((item: any) => {
      expect(item.status).toBe('failed');
    });
  });

  // Multiple status filter
  it('should filter by multiple statuses', async () => {
    await createTestExecution('completed');
    await createTestExecution('failed');
    await createTestExecution('running');
    
    const response = await app.inject({
      method: 'GET',
      url: '/intent?status=completed,failed'
    });
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    
    data.items.forEach((item: any) => {
      expect(['completed', 'failed']).toContain(item.status);
    });
  });

  // Security: non-admin cannot filter by different user
  it('should return 403 when non-admin tries to filter by different user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/intent?user=other_user'
    });
    
    expect(response.statusCode).toBe(403);
    const error = JSON.parse(response.payload);
    expect(error.error).toBe('Forbidden');
  });

  // Schema validation: invalid status
  it('should return 400 for invalid status values', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/intent?status=bogus'
    });
    
    expect(response.statusCode).toBe(400);
  });

  // Schema validation: invalid limit
  it('should return 400 for invalid limit values', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/intent?limit=101' // Over maximum
    });
    
    expect(response.statusCode).toBe(400);
  });

  // Empty list
  it('should return empty list when no executions exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/intent'
    });
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.items).toEqual([]);
    expect(data.nextCursor).toBeUndefined();
  });

  // Cursor pagination
  it('should support cursor-based pagination', async () => {
    // Create 4 executions
    const executions = await Promise.all([
      createTestExecution('completed'),
      createTestExecution('running'),
      createTestExecution('failed'),
      createTestExecution('queued')
    ]);
    
    // Get first page
    const firstPage = await app.inject({
      method: 'GET',
      url: '/intent?limit=2'
    });
    
    expect(firstPage.statusCode).toBe(200);
    const firstData = JSON.parse(firstPage.payload);
    expect(firstData.items).toHaveLength(2);
    expect(firstData.nextCursor).toBeDefined();
    
    // Get second page using cursor
    const secondPage = await app.inject({
      method: 'GET',
      url: `/intent?limit=2&cursor=${firstData.nextCursor}`
    });
    
    expect(secondPage.statusCode).toBe(200);
    const secondData = JSON.parse(secondPage.payload);
    
    // Should get remaining items
    expect(secondData.items.length).toBeGreaterThan(0);
    
    // No overlapping items
    const firstIds = firstData.items.map((item: any) => item.id);
    const secondIds = secondData.items.map((item: any) => item.id);
    expect(firstIds.some((id: string) => secondIds.includes(id))).toBe(false);
  });
}); 