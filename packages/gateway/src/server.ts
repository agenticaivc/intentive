import fastify, { FastifyInstance } from 'fastify';
import autoload from '@fastify/autoload';
import { join } from 'path';

export interface BuildOptions {
  logger?: boolean | object;
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
        removeAdditional: false, // Don't remove additional properties
        coerceTypes: 'array',
        useDefaults: true,
        allErrors: false
      }
    }
  });

  // Auto-load plugins
  app.register(autoload, { 
    dir: join(__dirname, 'plugins'),
    options: opts
  });

  // Auto-load routes
  app.register(autoload, { 
    dir: join(__dirname, 'routes'),
    options: opts
  });
  
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