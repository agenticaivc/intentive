import { JwtGuard } from '../../src/jwt';
import { GuardCtx, GuardInput } from '../../src/GuardABI';

describe('JwtGuard - Basic Functionality', () => {
  let mockContext: GuardCtx;
  let mockInput: GuardInput;

  beforeEach(() => {
    mockContext = {
      correlationId: 'test-corr-123',
      graphId: 'test-graph',
      executionId: 'test-exec-123',
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      } as any
    };

    mockInput = {
      correlationId: 'test-corr-123',
      user: { id: 'user-123', roles: ['user'], permissions: [] },
      nodeOrEdgeId: 'test-node',
      parameters: {},
      priorResults: {}
    };
  });

  describe('Guard Interface Compliance', () => {
    it('should implement Guard interface correctly', () => {
      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret'
      });

      expect(guard.name).toBe('jwt');
      expect(guard.type).toBe('rbac');
      expect(typeof guard.init).toBe('function');
      expect(typeof guard.validate).toBe('function');
      expect(typeof guard.execute).toBe('function');
      expect(typeof guard.cleanup).toBe('function');
    });

    it('should initialize without errors', async () => {
      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret'
      });

      await expect(guard.init(mockContext)).resolves.not.toThrow();
      expect(mockContext.logger?.info).toHaveBeenCalledWith(
        expect.stringContaining('JWT Guard initialized'),
        expect.objectContaining({
          algorithms: ['HS256'],
          clockSkewSeconds: 120
        })
      );
    });
  });

  describe('Token Extraction', () => {
    it('should reject request with missing token', async () => {
      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret'
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: {} // No authorization
      });

      expect(result.status).toBe('block');
      expect(result.message).toContain('Missing or invalid Authorization header');
      expect(result.meta?.code).toBe('INTENTIVE_JWT_INVALID');
      expect(result.meta?.httpStatus).toBe(401);
    });

    it('should reject request with invalid token format', async () => {
      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret'
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: { authorization: 'invalid-token' }
      });

      expect(result.status).toBe('block');
      expect(result.message).toContain('Missing or invalid Authorization header');
    });
  });

  describe('Configuration Validation', () => {
    it('should use default configuration values', () => {
      const guard = new JwtGuard();
      
      // Should not throw with default config
      expect(() => guard).not.toThrow();
    });

    it('should accept custom configuration', () => {
      const guard = new JwtGuard({
        algorithms: ['RS256'],
        jwksUri: 'https://example.com/.well-known/jwks.json',
        clockSkewSeconds: 60
      });
      
      expect(() => guard).not.toThrow();
    });
  });
}); 