import { z } from 'zod';

// Cycle detection helper function
function hasCycles(hierarchy: Record<string, string[]>): boolean {
  const visited = new Set<string>();
  const recStack = new Set<string>();
  
  function dfs(role: string): boolean {
    if (recStack.has(role)) return true; // Cycle found
    if (visited.has(role)) return false; // Already processed
    
    visited.add(role);
    recStack.add(role);
    
    const children = hierarchy[role] || [];
    for (const child of children) {
      if (dfs(child)) return true;
    }
    
    recStack.delete(role);
    return false;
  }
  
  for (const role of Object.keys(hierarchy)) {
    if (!visited.has(role) && dfs(role)) {
      return true;
    }
  }
  
  return false;
}

export const JwtConfigSchema = z.object({
  // JWT Verification - unified algorithms array, coerce single values
  algorithms: z.union([
    z.string(),
    z.array(z.string())
  ]).transform(val => Array.isArray(val) ? val : [val])
    .pipe(z.array(z.enum(['HS256', 'RS256', 'ES256', 'PS256'])).min(1))
    .default(['RS256']),
  
  // Keys and JWKS
  secret: z.string().optional(),
  publicKey: z.string().optional(),
  jwksUri: z.string().url().optional(),
  jwksCacheMaxAge: z.number().min(60000).max(3600000).default(300000), // 5 min default, 1-60 min range
  
  // Clock & Claims
  clockSkewSeconds: z.number().min(0).max(300).default(120),
  roleClaim: z.string().default('roles'),
  
  // Role Hierarchy with cycle detection
  hierarchy: z.record(z.array(z.string())).default({
    admin: ['manager'],
    manager: ['user']
  }).refine(
    (hierarchy) => !hasCycles(hierarchy),
    { message: "Role hierarchy contains cycles - this would cause infinite recursion" }
  ),
  
  defaultRequired: z.string().default('user'),
  
  // Audit & Rate Limiting
  audit: z.object({
    enabled: z.boolean().default(true),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    rateLimitWindowMs: z.number().default(30000),
    maxErrorsPerWindow: z.number().default(1)
  }).default({})
}).refine(
  (config) => {
    // Validate key configuration
    const hasSymmetricKey = !!config.secret;
    const hasAsymmetricKey = !!(config.publicKey || config.jwksUri);
    const needsSymmetric = config.algorithms.some(alg => alg.startsWith('HS'));
    const needsAsymmetric = config.algorithms.some(alg => !alg.startsWith('HS'));
    
    if (needsSymmetric && !hasSymmetricKey) {
      return false;
    }
    if (needsAsymmetric && !hasAsymmetricKey) {
      return false;
    }
    return true;
  },
  {
    message: "Key configuration mismatch: HS* algorithms need 'secret', RS*/ES*/PS* need 'publicKey' or 'jwksUri'"
  }
);

export type JwtConfig = z.infer<typeof JwtConfigSchema>; 