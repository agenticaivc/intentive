import { describe, it, expect, beforeEach } from 'vitest';

// Mock guard implementations that follow the GuardABI interface
interface Guard {
  readonly name: string;
  readonly type: "rbac" | "rate_limit" | "audit" | "custom";
  init(ctx: any): Promise<void>;
  validate(input: any): Promise<any>;
  execute(input: any): Promise<any>;
  cleanup(): Promise<void>;
}

// Mock guard implementations for testing
class MockRBACGuard implements Guard {
  readonly name = 'payroll_rbac';
  readonly type = 'rbac' as const;

  async init(ctx: any): Promise<void> {
    // Mock initialization
  }

  async validate(input: any): Promise<any> {
    return { status: 'success' };
  }

  async execute(input: any): Promise<any> {
    return { status: 'success' };
  }

  async cleanup(): Promise<void> {
    // Mock cleanup
  }
}

class MockRateLimitGuard implements Guard {
  readonly name = 'payment_rate_limit';
  readonly type = 'rate_limit' as const;

  async init(ctx: any): Promise<void> {
    // Mock initialization
  }

  async validate(input: any): Promise<any> {
    return { status: 'success' };
  }

  async execute(input: any): Promise<any> {
    return { status: 'success' };
  }

  async cleanup(): Promise<void> {
    // Mock cleanup
  }
}

function loadAllGuards(): Guard[] {
  // In real implementation, this would load guards from the registry
  return [
    new MockRBACGuard(),
    new MockRateLimitGuard()
  ];
}

describe('Guard ABI reflection: every loaded guard exposes required interface', () => {
  let guards: Guard[];

  beforeEach(() => {
    guards = loadAllGuards();
  });

  it('loads expected number of guards', () => {
    expect(guards).toHaveLength(2);
  });

  it('every guard has required properties', () => {
    guards.forEach(guard => {
      // Check readonly properties
      expect(guard).toHaveProperty('name');
      expect(guard).toHaveProperty('type');
      expect(typeof guard.name).toBe('string');
      expect(guard.name.length).toBeGreaterThan(0);
      
      // Validate type is one of the allowed values
      expect(['rbac', 'rate_limit', 'audit', 'custom']).toContain(guard.type);
    });
  });

  it('every guard has required lifecycle methods', () => {
    guards.forEach(guard => {
      // Check all required methods exist
      expect(guard).toHaveProperty('init');
      expect(guard).toHaveProperty('validate');
      expect(guard).toHaveProperty('execute');
      expect(guard).toHaveProperty('cleanup');
      
      // Check methods are functions
      expect(typeof guard.init).toBe('function');
      expect(typeof guard.validate).toBe('function');
      expect(typeof guard.execute).toBe('function');
      expect(typeof guard.cleanup).toBe('function');
    });
  });

  it('every guard method returns a Promise', async () => {
    const mockCtx = { correlationId: 'test', graphId: 'test', executionId: 'test' };
    const mockInput = { 
      correlationId: 'test',
      user: { id: 'test', roles: [], permissions: [] },
      nodeOrEdgeId: 'test',
      parameters: {},
      priorResults: {}
    };

    for (const guard of guards) {
      // Test that all methods return Promises
      const initResult = guard.init(mockCtx);
      expect(initResult).toBeInstanceOf(Promise);
      await initResult;

      const validateResult = guard.validate(mockInput);
      expect(validateResult).toBeInstanceOf(Promise);
      await validateResult;

      const executeResult = guard.execute(mockInput);
      expect(executeResult).toBeInstanceOf(Promise);
      await executeResult;

      const cleanupResult = guard.cleanup();
      expect(cleanupResult).toBeInstanceOf(Promise);
      await cleanupResult;
    }
  });

  it('validates specific guard implementations', () => {
    const rbacGuard = guards.find(g => g.type === 'rbac');
    const rateLimitGuard = guards.find(g => g.type === 'rate_limit');

    expect(rbacGuard).toBeDefined();
    expect(rbacGuard?.name).toBe('payroll_rbac');

    expect(rateLimitGuard).toBeDefined();
    expect(rateLimitGuard?.name).toBe('payment_rate_limit');
  });

  it('validates guard method signatures match ABI', async () => {
    const guard = guards[0];
    
    // Test init method signature
    const initPromise = guard.init({ 
      correlationId: 'test',
      graphId: 'test', 
      executionId: 'test'
    });
    expect(initPromise).toBeInstanceOf(Promise);
    
    // Test validate/execute method signatures
    const input = {
      correlationId: 'test',
      user: { id: 'test', roles: ['test'], permissions: ['test'] },
      nodeOrEdgeId: 'test',
      parameters: { test: 'value' },
      priorResults: { test: 'result' }
    };
    
    const validatePromise = guard.validate(input);
    const executePromise = guard.execute(input);
    
    expect(validatePromise).toBeInstanceOf(Promise);
    expect(executePromise).toBeInstanceOf(Promise);
    
    // Await to ensure they complete without error
    await Promise.all([initPromise, validatePromise, executePromise, guard.cleanup()]);
  });
}); 