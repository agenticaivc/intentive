import { NoopGuard } from '../../../examples/guards/noop-guard';
import { RbacGuard } from '../../../examples/guards/rbac-guard';
import { GuardCtx, GuardInput } from '../src/GuardABI';

describe('Guard ABI', () => {
  let mockContext: GuardCtx;
  let mockInput: GuardInput;

  beforeEach(() => {
    mockContext = {
      correlationId: 'test-123',
      graphId: 'test-graph',
      executionId: 'test-execution',
      logger: console
    };
    mockInput = {
      correlationId: 'test-123',
      user: {
        id: 'user-123',
        roles: ['user'],
        permissions: ['read']
      },
      nodeOrEdgeId: 'node-1',
      parameters: {},
      priorResults: {},
    };
  });

  describe('NoopGuard - Success Path', () => {
    let guard: NoopGuard;

    beforeEach(() => {
      guard = new NoopGuard();
    });

    it('should initialize successfully', async () => {
      await expect(guard.init(mockContext)).resolves.toBeUndefined();
    });

    it('should validate successfully', async () => {
      await guard.init(mockContext);
      const result = await guard.validate(mockInput);
      
      expect(result.status).toBe('success');
      expect(result.message).toContain('validation passed');
      expect(result.meta?.correlationId).toBe('test-123');
    });

    it('should execute successfully', async () => {
      await guard.init(mockContext);
      const result = await guard.execute(mockInput);
      
      expect(result.status).toBe('success');
      expect(result.message).toContain('execution completed');
      expect(result.meta?.correlationId).toBe('test-123');
    });

    it('should cleanup successfully', async () => {
      await guard.init(mockContext);
      await expect(guard.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('RbacGuard - Block Path', () => {
    it('should block when user lacks required roles', async () => {
      const config = {
        type: 'rbac' as const,
        requiredRoles: ['admin', 'superuser'],
        allowSuperuser: false
      };
      const guard = new RbacGuard(config);
      
      await guard.init(mockContext);
      const result = await guard.execute(mockInput);
      
      expect(result.status).toBe('block');
      expect(result.message).toContain('Access denied');
      expect(result.message).toContain('admin, superuser');
      expect(result.meta?.userRoles).toEqual(['user']);
    });

    it('should block when user lacks required permissions', async () => {
      const config = {
        type: 'rbac' as const,
        requiredRoles: ['user'],
        requiredPermissions: ['write', 'admin'],
        allowSuperuser: false
      };
      const guard = new RbacGuard(config);
      
      const inputWithUser = {
        ...mockInput,
        user: {
          id: 'user-123',
          roles: ['user'],
          permissions: ['read']
        }
      };
      
      await guard.init(mockContext);
      const result = await guard.execute(inputWithUser);
      
      expect(result.status).toBe('block');
      expect(result.message).toContain('missing required permissions');
      expect(result.meta?.requiredPermissions).toEqual(['write', 'admin']);
    });

    it('should allow superuser bypass when enabled', async () => {
      const config = {
        type: 'rbac' as const,
        requiredRoles: ['admin'],
        allowSuperuser: true
      };
      const guard = new RbacGuard(config);
      
      const inputWithSuperuser = {
        ...mockInput,
        user: {
          id: 'user-123',
          roles: ['superuser'],
          permissions: ['read']
        }
      };
      
      await guard.init(mockContext);
      const result = await guard.execute(inputWithSuperuser);
      
      expect(result.status).toBe('success');
      expect(result.message).toContain('Superuser access granted');
      expect(result.meta?.bypass).toBe('superuser');
    });

    it('should allow access with correct roles and permissions', async () => {
      const config = {
        type: 'rbac' as const,
        requiredRoles: ['user'],
        requiredPermissions: ['read'],
        allowSuperuser: false
      };
      const guard = new RbacGuard(config);
      
      await guard.init(mockContext);
      const result = await guard.execute(mockInput);
      
      expect(result.status).toBe('success');
      expect(result.message).toContain('RBAC access granted');
    });
  });

  describe('Delay Path (Mock)', () => {
    it('should handle delay status with retryAfterMs', async () => {
      // Create a mock guard that returns delay status
      class DelayGuard extends NoopGuard {
        async execute(i: GuardInput) {
          return {
            status: 'delay' as const,
            message: 'Rate limit exceeded',
            retryAfterMs: 5000,
            meta: { correlationId: i.correlationId }
          };
        }
      }
      
      const guard = new DelayGuard();
      await guard.init(mockContext);
      const result = await guard.execute(mockInput);
      
      expect(result.status).toBe('delay');
      expect(result.message).toContain('Rate limit exceeded');
      expect(result.retryAfterMs).toBe(5000);
    });
  });

  describe('Lifecycle', () => {
    it('should call cleanup exactly once', async () => {
      const guard = new NoopGuard();
      const cleanupSpy = jest.spyOn(guard, 'cleanup');
      
      await guard.init(mockContext);
      await guard.validate(mockInput);
      await guard.execute(mockInput);
      
      // Simulate workflow completion
      await guard.cleanup();
      
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });
  });
}); 