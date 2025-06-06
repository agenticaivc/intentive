import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { JwtGuard } from '../../src/jwt';
import { GuardCtx, GuardInput } from '../../src/GuardABI';
// Import Node.js crypto types for CryptoKey
import type { webcrypto } from 'crypto';

// Mock jose library to avoid ES module issues - same pattern as basic test
jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  createRemoteJWKSet: jest.fn(),
  importSPKI: jest.fn()
}));

// Import jose after mocking
import { jwtVerify, createRemoteJWKSet, importSPKI } from 'jose';

// Type the mocks properly
const mockJwtVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>;
const mockCreateRemoteJWKSet = createRemoteJWKSet as jest.MockedFunction<typeof createRemoteJWKSet>;
const mockImportSPKI = importSPKI as jest.MockedFunction<typeof importSPKI>;

describe('JwtGuard - Comprehensive Algorithm Tests', () => {
  let mockContext: GuardCtx;
  let mockInput: GuardInput;

  beforeEach(() => {
    jest.clearAllMocks();
    
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

  describe('HS256 Algorithm Tests', () => {
    it('should verify valid HS256 token successfully', async () => {
      // Mock successful JWT verification
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: 'user-123',
          roles: ['manager'],
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          iat: Math.floor(Date.now() / 1000)
        },
        protectedHeader: { alg: 'HS256' }
      } as any);

      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret-key'
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: { authorization: 'Bearer valid.jwt.token' }
      });

      expect(result.status).toBe('success');
      expect(result.message).toContain('JWT authentication successful');
      expect(result.meta?.userId).toBe('user-123');
      expect(result.meta?.roles).toEqual(['manager']);
      expect(mockJwtVerify).toHaveBeenCalledWith(
        'valid.jwt.token',
        expect.any(Uint8Array),
        expect.objectContaining({
          algorithms: ['HS256'],
          clockTolerance: 120
        })
      );
    });

    it('should handle base64-encoded secret', async () => {
      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'base64:dGVzdC1zZWNyZXQta2V5' // base64 encoded 'test-secret-key'
      });

      await expect(guard.init(mockContext)).resolves.not.toThrow();
      expect(mockContext.logger?.info).toHaveBeenCalledWith(
        expect.stringContaining('JWT Guard initialized'),
        expect.objectContaining({
          algorithms: ['HS256']
        })
      );
    });

    it('should reject invalid HS256 signature', async () => {
      mockJwtVerify.mockRejectedValue(new Error('Invalid signature'));

      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret-key'
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: { authorization: 'Bearer invalid.jwt.token' }
      });

      expect(result.status).toBe('block');
      expect(result.message).toContain('JWT verification failed: Invalid signature');
      expect(result.meta?.code).toBe('INTENTIVE_JWT_INVALID');
      expect(result.meta?.httpStatus).toBe(401);
    });
  });

  describe('RS256 Algorithm Tests', () => {
    it('should verify RS256 token with public key', async () => {
      const mockCryptoKey = {} as webcrypto.CryptoKey;
      mockImportSPKI.mockResolvedValue(mockCryptoKey);
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: 'user-456',
          roles: ['admin'],
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        protectedHeader: { alg: 'RS256' }
      } as any);

      const guard = new JwtGuard({
        algorithms: ['RS256'],
        publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQ...\n-----END PUBLIC KEY-----'
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: { authorization: 'Bearer rs256.jwt.token' }
      });

      expect(result.status).toBe('success');
      expect(result.meta?.userId).toBe('user-456');
      expect(result.meta?.roles).toEqual(['admin']);
      expect(mockImportSPKI).toHaveBeenCalledWith(
        expect.stringContaining('BEGIN PUBLIC KEY'),
        'RS256'
      );
    });

    it('should verify RS256 token with JWKS URI', async () => {
      // Setup proper JWKS mock that matches jose expectations
      const mockJwks = {
        coolingDown: false,
        fresh: true,
        reloading: false,
        reload: jest.fn(),
        jwks: () => ({ keys: [] }),
        // Mock the function call interface that jwtVerify expects
        ...jest.fn()
      };
      mockCreateRemoteJWKSet.mockReturnValue(mockJwks as any);
      
      // Mock jwtVerify to succeed when called with JWKS
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: 'user-789',
          scope: 'finance read write'
        },
        protectedHeader: { alg: 'RS256' }
      } as any);

      const guard = new JwtGuard({
        algorithms: ['RS256'],
        jwksUri: 'https://auth.example.com/.well-known/jwks.json',
        jwksCacheMaxAge: 300000
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: { authorization: 'Bearer jwks.jwt.token' }
      });

      expect(result.status).toBe('success');
      expect(result.meta?.userId).toBe('user-789');
      expect(result.meta?.roles).toEqual(['finance', 'read', 'write']); // From scope claim
      expect(mockCreateRemoteJWKSet).toHaveBeenCalledWith(
        new URL('https://auth.example.com/.well-known/jwks.json'),
        expect.objectContaining({
          cacheMaxAge: 300000,
          cooldownDuration: 5000
        })
      );
    });
  });

  describe('PS256 Algorithm Tests', () => {
    it('should support PS256 algorithm with public key', async () => {
      const mockCryptoKey = {} as webcrypto.CryptoKey;
      mockImportSPKI.mockResolvedValue(mockCryptoKey);
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: 'user-ps256',
          roles: ['finance_manager']
        },
        protectedHeader: { alg: 'PS256' }
      } as any);

      const guard = new JwtGuard({
        algorithms: ['PS256'],
        publicKey: '-----BEGIN PUBLIC KEY-----\nPS256KEY...\n-----END PUBLIC KEY-----'
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: { authorization: 'Bearer ps256.jwt.token' }
      });

      expect(result.status).toBe('success');
      expect(result.meta?.userId).toBe('user-ps256');
      expect(mockImportSPKI).toHaveBeenCalledWith(
        expect.stringContaining('PS256KEY'),
        'PS256'
      );
    });
  });

  describe('Token Expiry Tests', () => {
    it('should reject expired token', async () => {
      mockJwtVerify.mockRejectedValue(new Error('jwt expired'));

      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret'
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: { authorization: 'Bearer expired.jwt.token' }
      });

      expect(result.status).toBe('block');
      expect(result.message).toContain('JWT verification failed: jwt expired');
      expect(result.meta?.code).toBe('INTENTIVE_JWT_INVALID');
    });

    it('should respect clock skew tolerance', async () => {
      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret',
        clockSkewSeconds: 300 // 5 minutes
      });

      await guard.init(mockContext);

      // Verify clock skew is passed to jose
      await guard.execute({
        ...mockInput,
        parameters: { authorization: 'Bearer test.jwt.token' }
      });

      expect(mockJwtVerify).toHaveBeenCalledWith(
        'test.jwt.token',
        expect.any(Uint8Array),
        expect.objectContaining({
          clockTolerance: 300
        })
      );
    });
  });

  describe('Custom Role Claims Tests', () => {
    it('should extract roles from custom claim', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: 'user-custom',
          authorities: ['ROLE_ADMIN', 'ROLE_USER'] // Custom claim name
        },
        protectedHeader: { alg: 'HS256' }
      } as any);

      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret',
        roleClaim: 'authorities'
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: { authorization: 'Bearer custom.jwt.token' }
      });

      expect(result.status).toBe('success');
      expect(result.meta?.roles).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
    });

    it('should handle space-delimited scope claim', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: 'user-scope',
          scope: 'read write admin'
        },
        protectedHeader: { alg: 'HS256' }
      } as any);

      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret'
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: { authorization: 'Bearer scope.jwt.token' }
      });

      expect(result.status).toBe('success');
      expect(result.meta?.roles).toEqual(['read', 'write', 'admin']);
    });
  });

  describe('Multi-Source Token Extraction Tests', () => {
    it('should extract token from Bearer header', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'user-bearer', roles: ['user'] },
        protectedHeader: { alg: 'HS256' }
      } as any);

      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret'
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: { authorization: 'Bearer bearer.jwt.token' }
      });

      expect(result.status).toBe('success');
      expect(mockJwtVerify).toHaveBeenCalledWith('bearer.jwt.token', expect.any(Uint8Array), expect.any(Object));
    });

    it('should extract token from direct jwt parameter', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'user-direct', roles: ['user'] },
        protectedHeader: { alg: 'HS256' }
      } as any);

      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret'
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: { jwt: 'direct.jwt.token' }
      });

      expect(result.status).toBe('success');
      expect(mockJwtVerify).toHaveBeenCalledWith('direct.jwt.token', expect.any(Uint8Array), expect.any(Object));
    });

    it('should prioritize Authorization header over direct jwt parameter', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'user-priority', roles: ['user'] },
        protectedHeader: { alg: 'HS256' }
      } as any);

      const guard = new JwtGuard({
        algorithms: ['HS256'],
        secret: 'test-secret'
      });

      await guard.init(mockContext);
      
      const result = await guard.execute({
        ...mockInput,
        parameters: { 
          authorization: 'Bearer priority.jwt.token',
          jwt: 'secondary.jwt.token'
        }
      });

      expect(result.status).toBe('success');
      expect(mockJwtVerify).toHaveBeenCalledWith('priority.jwt.token', expect.any(Uint8Array), expect.any(Object));
    });
  });
}); 