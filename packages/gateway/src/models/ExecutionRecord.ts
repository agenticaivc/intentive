export interface ExecutionRecord {
  id: string;
  createdAt: Date;
  status: 'queued' | 'running' | 'completed' | 'failed';
  durationMs?: number;
  result?: unknown;
  error?: string;
  archived?: boolean;
  // Added for rich observability
  graphId?: string;
  correlationId?: string;
  userId?: string;
}

export interface ExecutionStoreConfig {
  driver: 'redis' | 'memory';
  ttlDays: number;
  redisUrl?: string;
  pgConnString?: string;
} 