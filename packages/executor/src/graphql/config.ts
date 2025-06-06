// Centralized GraphQL configuration for v0.1
// Follows Drew Barrymore Protocol: Type-safe, testable, no process.env scattered

export interface GraphQLConfig {
  gqlEndpoint: string;
  timeout: number;
  retryDelay: number;
  validate: boolean;
  forceFallback: boolean;
  debug: boolean;
}

// Centralized config - easier to mock in tests
export const cfg: GraphQLConfig = {
  gqlEndpoint: process.env.GRAPHQL_ENDPOINT || '',
  timeout: Number(process.env.GRAPHQL_TIMEOUT ?? 5000),
  retryDelay: Number(process.env.GRAPHQL_RETRY_DELAY ?? 1000),
  validate: process.env.GQL_VALIDATE === 'true',
  forceFallback: process.env.FORCE_GRAPHQL_FALLBACK === 'true',
  debug: process.env.DEBUG?.includes('fallback') ?? false,
};

// Validation helper - fail fast on invalid config
export function validateConfig(): void {
  if (!cfg.gqlEndpoint) {
    throw new Error('GRAPHQL_ENDPOINT environment variable is required');
  }
  if (cfg.timeout <= 0 || cfg.timeout > 30000) {
    throw new Error('GRAPHQL_TIMEOUT must be between 1-30000ms');
  }
  if (cfg.retryDelay < 0) {
    throw new Error('GRAPHQL_RETRY_DELAY must be non-negative');
  }
}

// Check if GraphQL fallback is enabled
export function isGraphQLEnabled(): boolean {
  return Boolean(cfg.gqlEndpoint);
} 