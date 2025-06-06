export const intentListQuerySchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      pattern: '^(queued|running|completed|failed)(,(queued|running|completed|failed))*$',
      description: 'Comma-separated list of statuses to filter by'
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Maximum number of items to return'
    },
    cursor: {
      type: 'string',
      description: 'Execution ID for keyset pagination'
    },
    user: {
      type: 'string',
      description: 'User ID to filter by (admin only)'
    }
  },
  additionalProperties: false
} as const;

export const intentListResponseSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          graph: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          status: { 
            type: 'string', 
            enum: ['queued', 'running', 'completed', 'failed'] 
          },
          durationMs: { type: 'number' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' }
            },
            required: ['id']
          }
        },
        required: ['id', 'graph', 'createdAt', 'status', 'user']
      }
    },
    nextCursor: { type: 'string' }
  },
  required: ['items'],
  additionalProperties: false
} as const;

// Type inference from schemas
export type IntentListQuery = {
  status?: string;
  limit?: number;
  cursor?: string;
  user?: string;
};

export type IntentListResponse = {
  items: Array<{
    id: string;
    graph: string;
    createdAt: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    durationMs?: number;
    user: { id: string };
  }>;
  nextCursor?: string;
}; 