// @ts-ignore - ioredis-mock doesn't have types, but functionality is what matters
import RedisMock from 'ioredis-mock';

export interface UserContext {
  id: string;
  roles: string[];
  permissions: string[];
}

export interface IntentGraph {
  apiVersion: string;
  kind: string;
  metadata: any;
  spec: any;
}

export interface PayrollExecutionResult {
  status: 'SUCCESS' | 'FAILED' | 'DELAYED';
  nodesExecuted: number;
  executionTime: number;
  errors: Error[];
}

export interface TestContext {
  user: UserContext;
  graph: IntentGraph;
  mockRedis: any;
}

// Track request counts for rate limiting simulation
const requestCounts = new Map<string, number>();

export function getRedis() {
  return process.env.TEST_USE_REAL_REDIS === 'true' 
    ? require('ioredis')(process.env.REDIS_URL) 
    : new RedisMock();
}

// Performance timing with Chrome DevTools integration
export function createPerformanceTracker() {
  return {
    start: (testName: string) => performance.mark(`start-${testName}`),
    end: (testName: string) => {
      performance.measure(testName, `start-${testName}`);
      const entries = performance.getEntriesByName(testName);
      return entries[entries.length - 1]?.duration || 0;
    }
  };
}

export async function setupFixtures(): Promise<TestContext> {
  const mockRedis = getRedis();
  
  // Load payroll graph (would normally parse YAML)
  const graph: IntentGraph = {
    apiVersion: "intentive.dev/v1",
    kind: "IntentGraph", 
    metadata: {
      name: "payroll-processing"
    },
    spec: {}
  };

  const user: UserContext = {
    id: 'test_user',
    roles: ['finance_manager'],
    permissions: ['payroll:read', 'payroll:write']
  };

  return { user, graph, mockRedis };
}

// Mock implementation of runExecutor with RBAC and rate limiting logic
export async function runExecutor(
  graph: IntentGraph, 
  user: UserContext, 
  params: Record<string, any>
): Promise<PayrollExecutionResult> {
  // Check RBAC guards
  const rbacGuards = graph.spec.guards?.filter((g: any) => g.type === 'rbac') || [];
  
  for (const guard of rbacGuards) {
    const requiredRoles = guard.config.required_roles || [];
    const requiredPermissions = guard.config.required_permissions || [];
    
    // Check if user has at least one required role
    const hasRequiredRole = requiredRoles.some((role: string) => user.roles.includes(role));
    
    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every((perm: string) => user.permissions.includes(perm));
    
    if (!hasRequiredRole || !hasAllPermissions) {
      return {
        status: 'FAILED',
        nodesExecuted: 0,
        executionTime: 500,
        errors: [new Error(`RBAC guard blocked: User lacks required roles ${requiredRoles.join(', ')}`)]
      };
    }
  }
  
  // Check rate limiting guards
  const rateLimitGuards = graph.spec.guards?.filter((g: any) => g.type === 'rate_limit') || [];
  
  for (const guard of rateLimitGuards) {
    const maxRequests = guard.config.max_requests || 10;
    const windowSeconds = guard.config.window_seconds || 3600;
    
    // Create a unique key for this user and guard
    const rateLimitKey = `${user.id}:${guard.name}`;
    
    // Get current request count
    const currentCount = requestCounts.get(rateLimitKey) || 0;
    
    // Check if rate limit exceeded
    if (currentCount >= maxRequests) {
      return {
        status: 'DELAYED',
        nodesExecuted: 0,
        executionTime: 100,
        errors: [new Error(`Rate limit exceeded: ${currentCount}/${maxRequests} requests in ${windowSeconds}s window`)]
      };
    }
    
    // Increment request count
    requestCounts.set(rateLimitKey, currentCount + 1);
  }
  
  // Mock successful execution for authorized users
  return {
    status: 'SUCCESS',
    nodesExecuted: graph.spec.nodes?.length || 5,
    executionTime: 1500, // ms
    errors: []
  };
}

export function logCIHealth() {
  const health = {
    nodeVersion: process.version,
    platform: process.platform,
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptime: Math.round(process.uptime()),
    env: {
      ci: process.env.CI,
      github: process.env.GITHUB_ACTIONS,
      runner: process.env.RUNNER_OS
    }
  };
  
  console.log('🏥 CI Health Check:', JSON.stringify(health, null, 2));
  return health;
} 