import { parseRouterConfig } from '../src/schemas/router';

describe('Router Configuration', () => {
  it('should parse valid router config', () => {
    const validConfig = {
      routes: [
        {
          pattern: '/test',
          method: 'GET',
          handler: 'intent'
        }
      ]
    };

    const result = parseRouterConfig(validConfig);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].pattern).toBe('/test');
    expect(result.routes[0].method).toBe('GET');
    expect(result.routes[0].handler).toBe('intent');
  });

  it('should fail on invalid method', () => {
    const invalidConfig = {
      routes: [
        {
          pattern: '/test',
          method: 'INVALID',
          handler: 'intent'
        }
      ]
    };

    expect(() => parseRouterConfig(invalidConfig)).toThrow('Invalid router configuration');
  });

  it('should fail on invalid handler', () => {
    const invalidConfig = {
      routes: [
        {
          pattern: '/test',
          method: 'GET',
          handler: 'invalid'
        }
      ]
    };

    expect(() => parseRouterConfig(invalidConfig)).toThrow('Invalid router configuration');
  });
}); 