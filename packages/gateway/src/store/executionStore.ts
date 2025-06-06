import { ExecutionRecord, ExecutionStoreConfig } from '../models/ExecutionRecord';

export interface ExecutionListOptions {
  userId?: string;
  status?: string[];
  limit: number;
  cursor?: string;
  isAdmin: boolean;
}

export interface ExecutionListResult {
  items: Array<{
    id: string;
    graph: string;
    createdAt: Date;
    status: 'queued' | 'running' | 'completed' | 'failed';
    durationMs?: number;
    user: { id: string };
  }>;
  nextCursor?: string;
}

export interface ExecutionStore {
  get(id: string): Promise<ExecutionRecord | null>;
  upsert(record: ExecutionRecord): Promise<void>;
  wait(id: string, timeoutMs: number): Promise<ExecutionRecord | null>;
  delete(id: string): Promise<void>;
  archive(id: string): Promise<void>;
  list(options: ExecutionListOptions): Promise<ExecutionListResult>;
}

class MemoryExecutionStore implements ExecutionStore {
  private records = new Map<string, ExecutionRecord>();
  private subscribers = new Map<string, Array<(record: ExecutionRecord) => void>>();
  private config: ExecutionStoreConfig;

  constructor(config: ExecutionStoreConfig) {
    this.config = config;
    this.startTTLCleanup();
  }

  async get(id: string): Promise<ExecutionRecord | null> {
    return this.records.get(id) || null;
  }

  async upsert(record: ExecutionRecord): Promise<void> {
    this.records.set(record.id, record);
    
    // Notify waiters
    const waiters = this.subscribers.get(record.id) || [];
    waiters.forEach(callback => callback(record));
    this.subscribers.delete(record.id);
  }

  async wait(id: string, timeoutMs: number): Promise<ExecutionRecord | null> {
    const existing = await this.get(id);
    if (existing && !['queued', 'running'].includes(existing.status)) {
      return existing;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.removeSubscriber(id, resolve);
        resolve(null);
      }, timeoutMs);

      const callback = (record: ExecutionRecord) => {
        if (!['queued', 'running'].includes(record.status)) {
          clearTimeout(timeout);
          resolve(record);
        }
      };

      if (!this.subscribers.has(id)) {
        this.subscribers.set(id, []);
      }
      this.subscribers.get(id)!.push(callback);
    });
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  async archive(id: string): Promise<void> {
    const record = this.records.get(id);
    if (record) {
      record.archived = true;
      this.records.set(id, record);
    }
  }

  private removeSubscriber(id: string, callback: any): void {
    const subscribers = this.subscribers.get(id) || [];
    const index = subscribers.indexOf(callback);
    if (index > -1) {
      subscribers.splice(index, 1);
      if (subscribers.length === 0) {
        this.subscribers.delete(id);
      }
    }
  }

  private startTTLCleanup(): void {
    setInterval(() => {
      const ttlMs = this.config.ttlDays * 24 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - ttlMs);
      
      for (const [id, record] of this.records.entries()) {
        if (record.createdAt < cutoff) {
          this.records.delete(id);
        }
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  async list(options: ExecutionListOptions): Promise<ExecutionListResult> {
    const { userId, status, limit, cursor, isAdmin } = options;
    
    // Get all records as array for filtering and sorting
    let allRecords = Array.from(this.records.values());
    
    // Filter by user if not admin
    if (!isAdmin && userId) {
      allRecords = allRecords.filter(record => record.userId === userId);
    } else if (userId) {
      // Admin filtering by specific user
      allRecords = allRecords.filter(record => record.userId === userId);
    } else if (!isAdmin) {
      // Non-admin sees only their own records (default user filtering needed)
      // For MVP, assuming 'anonymous' user
      allRecords = allRecords.filter(record => record.userId === 'anonymous');
    }
    
    // Filter by status if provided
    if (status && status.length > 0) {
      allRecords = allRecords.filter(record => status.includes(record.status));
    }
    
    // Filter out archived records
    allRecords = allRecords.filter(record => !record.archived);
    
    // Sort by createdAt descending (most recent first)
    allRecords.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Apply cursor-based pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = allRecords.findIndex(record => record.id === cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1; // Start after the cursor
      }
    }
    
    // Get page of results
    const pageRecords = allRecords.slice(startIndex, startIndex + limit);
    
    // Map to response format
    const items = pageRecords.map(record => ({
      id: record.id,
      graph: record.graphId || 'unknown',
      createdAt: record.createdAt,
      status: record.status,
      durationMs: record.durationMs,
      user: { id: record.userId || 'anonymous' }
    }));
    
    // Determine if there are more results
    const hasMore = startIndex + limit < allRecords.length;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined;
    
    return {
      items,
      nextCursor
    };
  }
}

// Factory function
export function createExecutionStore(config: ExecutionStoreConfig): ExecutionStore {
  switch (config.driver) {
    case 'memory':
      return new MemoryExecutionStore(config);
    case 'redis':
      throw new Error('Redis driver not implemented yet'); // TODO: Phase 2
    default:
      throw new Error(`Unknown store driver: ${config.driver}`);
  }
}

// Singleton instance
let store: ExecutionStore | null = null;

export function getExecutionStore(): ExecutionStore {
  if (!store) {
    const config: ExecutionStoreConfig = {
      driver: (process.env.STORE_DRIVER as 'redis' | 'memory') || 'memory',
      ttlDays: parseInt(process.env.EXECUTION_TTL_DAYS || '7'),
      redisUrl: process.env.REDIS_URL,
      pgConnString: process.env.PG_CONN
    };
    store = createExecutionStore(config);
  }
  return store;
} 