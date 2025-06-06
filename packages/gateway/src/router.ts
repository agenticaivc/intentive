import { FastifyInstance } from 'fastify';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'yaml';
import { parseRouterConfig, RouteConfig } from './schemas/router';

// Import IntentExecutionError from the correct path
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

export interface RouteHandler {
  (request: any, reply: any): Promise<any>;
}

export class RouterHelper {
  private handlers: Map<string, RouteHandler> = new Map();
  private routeCache: Set<string> = new Set(); // Prevent double-registration
  
  constructor(
    private intentExecutor: any, // Will be properly typed after interface verification
    private graphqlFallback: any  // Will be properly typed after interface verification
  ) {
    this.setupHandlers();
  }
  
  /**
   * Register routes on Fastify instance from YAML config with caching
   */
  registerRoutes(fastify: FastifyInstance): void {
    const config = this.loadRouterConfig();
    
    for (const route of config.routes) {
      const routeKey = `${route.method}:${route.pattern}`;
      
      // Skip if already registered (hot-reload protection)
      if (this.routeCache.has(routeKey)) {
        fastify.log.debug(`Route ${routeKey} already registered, skipping`);
        continue;
      }
      
      this.registerSingleRoute(fastify, route);
      this.routeCache.add(routeKey);
    }
  }
  
  private loadRouterConfig() {
    // Use relative path from current working directory
    const configPath = join(__dirname, '..', 'config', 'gateway.routes.yaml');
    
    if (!existsSync(configPath)) {
      throw new Error(`Router config not found at: ${configPath}`);
    }
    
    try {
      const rawConfig = yaml.parse(readFileSync(configPath, 'utf8'));
      return parseRouterConfig(rawConfig); // Fail-fast validation
    } catch (error) {
      throw new Error(`Failed to load router config: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  private registerSingleRoute(fastify: FastifyInstance, route: RouteConfig): void {
    const handler = this.handlers.get(route.handler);
    if (!handler) {
      throw new IntentExecutionError(
        `Handler not found: ${route.handler}`,
        'HANDLER_NOT_FOUND'
      );
    }
    
    const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
    
    fastify[method](route.pattern, {
      // Schema validation could be added here per route
    }, handler);
    
    fastify.log.info(`Route registered: ${route.method} ${route.pattern} -> ${route.handler}`);
  }
  
  private setupHandlers(): void {
    // Generic intent handler
    this.handlers.set('intent', async (request, reply) => {
      // INTERFACE VERIFICATION REQUIRED: Check intentExecutor method signature
      const result = await this.intentExecutor.execute(request.body, {
        requestId: request.requestId,
        headers: request.headers,
        params: request.params,
        query: request.query
      });
      
      reply.code(202).send(result);
    });
    
    // Generic GraphQL fallback handler (no dedicated route file needed)
    this.handlers.set('graphqlFallback', async (request, reply) => {
      try {
        // Transform request to node-like structure for GraphQL fallback
        const mockNode = {
          id: request.requestId,
          type: 'graphql' as const, // Changed from 'data' for clarity
          properties: {
            name: 'graphql-fallback',
            handler: 'graphql'
          }
        };
        
        const mockContext = {
          graphId: 'graphql-fallback',
          executionId: request.requestId,
          correlationId: request.requestId,
          user: {
            id: 'api-user',
            roles: [],
            permissions: []
          },
          config: {}
        };
        
        const result = await this.graphqlFallback.execute(mockNode, mockContext);
        
        reply.code(200).send({
          data: result,
          meta: {
            executionId: request.requestId,
            timestamp: new Date().toISOString()
          }
        });
        
      } catch (error) {
        throw new IntentExecutionError(
          error instanceof Error ? error.message : 'GraphQL fallback failed',
          'GRAPHQL_FALLBACK_ERROR',
          500,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    });
  }
} 