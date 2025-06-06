export interface JwtConfig {
  algorithms: ('HS256' | 'RS256' | 'ES256' | 'PS256')[];
  secret?: string;
  publicKey?: string;
  jwksUri?: string;
  jwksCacheMaxAge: number;
  clockSkewSeconds: number;
  roleClaim: string;
  hierarchy: Record<string, string[]>;
  defaultRequired: string;
  audit: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    rateLimitWindowMs: number;
    maxErrorsPerWindow: number;
  };
}

export interface JwtClaims {
  sub: string;
  roles?: string[];
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export interface RoleCheckResult {
  hasAccess: boolean;
  missingRoles: string[];
  effectiveRoles: string[];
  matchedExpression?: string;
} 