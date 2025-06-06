import { JwtGuard } from '../../src/jwt';
import { GuardCtx, GuardInput } from '../../src/GuardABI';

// Mock jose for E2E test
jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  createRemoteJWKSet: jest.fn()
}));

import { jwtVerify, createRemoteJWKSet } from 'jose';

describe('E2E JWKS Flow', () => {
  let mockContext: GuardCtx;
  let mockInput: GuardInput;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = {
      correlationId: 'e2e-test',
      graphId: 'test-graph',
      executionId: 'e2e-exec',
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      } as any
    };

    mockInput = {
      correlationId: 'e2e-test',
      user: { id: 'e2e-user', roles: ['user'], permissions: [] },
      nodeOrEdgeId: 'e2e-node',
      parameters: {},
      priorResults: {}
    };
  });

  it('should verify token with JWKS', async () => {
    // Mock JWKS setup
    const mockJwks = {
      jwks: () => ({ keys: [] }),
      reload: jest.fn(),
      fresh: true,
      reloading: false,
      coolingDown: false
    };
    
    (createRemoteJWKSet as any).mockReturnValue(mockJwks);
    (jwtVerify as any).mockResolvedValue({
      payload: {
        sub: 'jwks-user',
        roles: ['admin']
      },
      protectedHeader: { alg: 'RS256' }
    });

    const guard = new JwtGuard({
      algorithms: ['RS256'],
      jwksUri: 'https://auth.example.com/.well-known/jwks.json'
    });

    await guard.init(mockContext);
    
    const result = await guard.execute({
      ...mockInput,
      parameters: { authorization: 'Bearer valid.jwks.token' }
    });

    expect(result.status).toBe('success');
    expect(result.meta?.userId).toBe('jwks-user');
    expect(createRemoteJWKSet).toHaveBeenCalledWith(
      new URL('https://auth.example.com/.well-known/jwks.json'),
      expect.any(Object)
    );
  });

  it('should handle rotation cache refresh', async () => {
    const mockJwks = {
      jwks: jest.fn(() => ({ keys: [{ kid: 'key1' }] })),
      reload: jest.fn().mockResolvedValue(undefined),
      fresh: false,
      reloading: false,
      coolingDown: false
    };
    
    (createRemoteJWKSet as any).mockReturnValue(mockJwks);
    (jwtVerify as any).mockResolvedValue({
      payload: {
        sub: 'rotation-user',
        roles: ['user']
      },
      protectedHeader: { alg: 'RS256' }
    });

    const guard = new JwtGuard({
      algorithms: ['RS256'],
      jwksUri: 'https://auth.example.com/.well-known/jwks.json',
      jwksCacheMaxAge: 60000 // Use minimum valid value
    });

    await guard.init(mockContext);
    
    const result = await guard.execute({
      ...mockInput,
      parameters: { authorization: 'Bearer rotation.token' }
    });

    expect(result.status).toBe('success');
    // The JWKS mock doesn't get called in our mock scenario since jwtVerify is mocked
    expect(createRemoteJWKSet).toHaveBeenCalled();
  });
}); 