import fastify, { FastifyInstance } from 'fastify';
import autoload from '@fastify/autoload';
import { join } from 'path';

export interface BuildOptions {
  logger?: boolean | object;
  useRouterConfig?: boolean;
}

export function build(opts: BuildOptions = {}): FastifyInstance {
  const app = fastify({
    ...opts,
    logger: opts.logger !== false ? {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: { colorize: true }
      } : undefined
    } : false,
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: 'array',
        useDefaults: true,
        allErrors: false
      }
    }
  });

  // UNIFIED HEALTH CHECK - Always bypasses router YAML, stays green even if YAML is broken
  app.get('/__health', (_, reply) => {
    reply.code(200).send({ 
      ok: true, 
      timestamp: new Date().toISOString(),
      service: 'intentive-gateway'
    });
  });

  // Auto-load plugins (includes enhanced logger & router hooks)
  app.register(autoload, { 
    dir: join(__dirname, 'plugins'),
    options: opts
  });

  // Determine router config usage - dogfood in development
  const shouldUseRouterConfig = opts.useRouterConfig ?? 
    (process.env.USE_ROUTER_CONFIG === 'true' || process.env.NODE_ENV === 'development');

  if (shouldUseRouterConfig) {
    try {
      // Lazy load router dependencies only when needed
      const { RouterHelper } = require('./router');
      const { Executor, GraphQLFallback } = require('@intentive/executor');
      
      const executor = new Executor();
      const graphqlFallback = new GraphQLFallback();
      const router = new RouterHelper(executor, graphqlFallback);
      
      router.registerRoutes(app);
      app.log.info('Router config enabled - using YAML-driven routes');
    } catch (error) {
      app.log.error(`Router config failed, falling back to auto-load: ${error instanceof Error ? error.message : error}`);
      // Fallback to legacy auto-load
      app.register(autoload, { 
        dir: join(__dirname, 'routes'),
        options: opts
      });
    }
  } else {
    // Legacy: Auto-load routes
    app.register(autoload, { 
      dir: join(__dirname, 'routes'),
      options: opts
    });
    app.log.info('Using legacy auto-loaded routes');
  }
  
  return app;
}

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 4000;
  const HOST = process.env.HOST || '0.0.0.0';
  
  const server = build();
  
  server.listen({ port: PORT, host: HOST }, (err, address) => {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
    server.log.info(`Gateway server listening on ${address}`);
  });
} 