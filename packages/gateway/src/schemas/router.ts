import { z } from 'zod';

// Extract HTTP verbs enum once for reuse
export const HttpVerb = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
export const HandlerType = z.enum(['intent', 'graphqlFallback']);

export const RouteConfigSchema = z.object({
  pattern: z.string(),
  method: HttpVerb,
  handler: HandlerType,
  middleware: z.array(z.string()).optional().default([])
});

export const RouterConfigSchema = z.object({
  routes: z.array(RouteConfigSchema)
});

export type RouteConfig = z.infer<typeof RouteConfigSchema>;
export type RouterConfig = z.infer<typeof RouterConfigSchema>;

// Fail-fast YAML validation
export const parseRouterConfig = (raw: unknown): RouterConfig => {
  try {
    return RouterConfigSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid router configuration: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}; 