import { RateLimitGuard } from '../../src/rate-limit/RateLimitGuard';
import { GuardCtx, GuardInput } from '../../src/GuardABI';

describe('RateLimitGuard', () => {
  it('should implement Guard interface correctly', () => {
    const guard = new RateLimitGuard();
    expect(guard.name).toBe('rate_limit');
    expect(guard.type).toBe('rate_limit');
  });

  it('should have all required Guard methods', () => {
    const guard = new RateLimitGuard();
    expect(typeof guard.init).toBe('function');
    expect(typeof guard.validate).toBe('function');
    expect(typeof guard.execute).toBe('function');
    expect(typeof guard.cleanup).toBe('function');
  });

  it('should return success when config is not loaded', async () => {
    const guard = new RateLimitGuard();
    const mockInput: GuardInput = {
      correlationId: 'test',
      user: { id: 'test-user', roles: [], permissions: [] },
      nodeOrEdgeId: 'test-node',
      parameters: {},
      priorResults: {}
    };

    // Without init, config should be null and guard should return success
    const result = await guard.validate(mockInput);
    expect(result.status).toBe('success');
  });
});
