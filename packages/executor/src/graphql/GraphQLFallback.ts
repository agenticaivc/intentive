// GraphQL Fallback Implementation - v0.1 Walking Skeleton
// Follows Drew Barrymore Protocol: Type-safe, incremental, no assumptions

import { IntentNode, ExecutionContext, NodeType } from '../types';
import { cfg, validateConfig } from './config';
import { log, logQuery, logResponse, logError } from './logger';

// Type-safe interfaces - no 'any' types per Drew Barrymore Protocol
export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ 
    message: string; 
    path?: string[]; 
    extensions?: Record<string, unknown>;
  }>;
}

export interface NormalizedResponse {
  data: unknown;
  meta: {
    executionTime: number;
    endpoint: string;
    debug?: { originalResponse: GraphQLResponse };
  };
  errors: IntentExecutionError[];
}

// Custom error type - matches existing NlpError pattern from codebase
export class IntentExecutionError extends Error {
  constructor(
    message: string,
    public readonly type: string,
    public readonly statusCode?: number,
    public readonly rootCause?: Error
  ) {
    super(message);
    this.name = 'IntentExecutionError';
  }
}

// Security: Query size limit to prevent DoS
const MAX_QUERY_SIZE = 100_000; // 100 KB

// Main GraphQL fallback class - all-in-one for v0.1 simplicity  
export class GraphQLFallback {
  private schemaCache = new Map<string, unknown>(); // Simple in-process cache
  
  constructor() {
    // Fail fast on invalid config per Drew Barrymore Protocol
    validateConfig();
  }

  async execute(node: IntentNode, context: ExecutionContext): Promise<unknown> {
    const startTime = Date.now();
    
    try {
      // 1. Translate intent to GraphQL query
      const request = this.translateIntent(node);
      
      // 2. Security guardrail - prevent DoS by huge queries
      const querySize = JSON.stringify(request).length;
      if (querySize > MAX_QUERY_SIZE) {
        throw new IntentExecutionError(
          `Query too large (${querySize} bytes)`,
          'GRAPHQL_TOO_LARGE'
        );
      }
      
      // 3. Log query for debugging
      logQuery(node.id, request.query, request.variables);
      
      // 4. Validate if feature flag enabled
      if (cfg.validate) {
        await this.validateQuery(request.query);
      }
      
      // 5. Execute with 1-shot retry
      const response = await this.executeWithRetry(request);
      
      // 6. Log response
      logResponse(node.id, Date.now() - startTime, true);
      
      // 7. Normalize response
      const normalized = this.normalizeResponse(response, Date.now() - startTime);
      
      return normalized.data;
      
    } catch (error) {
      logResponse(node.id, Date.now() - startTime, false);
      logError(node.id, error instanceof Error ? error : new Error(String(error)));
      
      throw new IntentExecutionError(
        `GraphQL fallback failed for node ${node.id}`,
        'GRAPHQL_EXECUTION_ERROR',
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private translateIntent(node: IntentNode): GraphQLRequest {
    // Explicit handling for known types - test harness will catch gaps
    switch (node.type) {
      case 'data':
        return {
          query: `query GetData($id: ID!) { 
            data(id: $id) { 
              id 
              name 
              value 
            } 
          }`,
          variables: { id: node.properties.name || node.id }
        };
        
      case 'action':
        return {
          query: `query GetAction($name: String!) { 
            action(name: $name) { 
              status 
              result 
            } 
          }`,
          variables: { name: node.properties.name }
        };
        
      default:
        // This should be caught by the test harness
        throw new IntentExecutionError(
          `Unsupported node type for GraphQL translation: ${node.type}`,
          'UNSUPPORTED_NODE_TYPE'
        );
    }
  }

  private async validateQuery(query: string): Promise<void> {
    // Feature-flagged validation - only when GQL_VALIDATE=true
    if (!this.schemaCache.has(cfg.gqlEndpoint)) {
      const schema = await this.introspectSchema();
      this.schemaCache.set(cfg.gqlEndpoint, schema);
    }
    
    // Basic validation - just check if query parses
    if (!query.trim().startsWith('query') && !query.trim().startsWith('mutation')) {
      throw new IntentExecutionError(
        'Invalid GraphQL query format',
        'INVALID_QUERY_FORMAT'
      );
    }
  }

  private async introspectSchema(): Promise<unknown> {
    // Minimal introspection for v0.1
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          types {
            name
            kind
          }
        }
      }
    `;
    
    const response = await this.fetchGraphQL({ query: introspectionQuery });
    return response.data;
  }

  private async executeWithRetry(request: GraphQLRequest): Promise<GraphQLResponse> {
    let lastError: Error | null = null;
    
    // Try once, then retry once with backoff (1-shot retry for v0.1)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.fetchGraphQL(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < 1) {
          // Wait before retry with exponential backoff
          await this.sleep(cfg.retryDelay * Math.pow(2, attempt));
        }
      }
    }
    
    throw lastError || new Error('Unknown GraphQL execution error');
  }

  private async fetchGraphQL(request: GraphQLRequest): Promise<GraphQLResponse> {
    // Use node-fetch for Node.js compatibility, fallback to global fetch
    const fetchImpl = global.fetch || (await import('node-fetch')).default;
    
    const response = await fetchImpl(cfg.gqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(request),
      // @ts-ignore - AbortSignal.timeout might not be available in all environments
      signal: AbortSignal.timeout ? AbortSignal.timeout(cfg.timeout) : undefined
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    
    if (json.errors && json.errors.length > 0) {
      throw new Error(`GraphQL errors: ${json.errors.map((e: any) => e.message).join(', ')}`);
    }
    
    return json as GraphQLResponse;
  }

  private normalizeResponse(
    response: GraphQLResponse, 
    executionTime: number
  ): NormalizedResponse {
    return {
      data: response.data,
      meta: {
        executionTime,
        endpoint: cfg.gqlEndpoint,
        debug: cfg.debug ? { originalResponse: response } : undefined
      },
      errors: []
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 