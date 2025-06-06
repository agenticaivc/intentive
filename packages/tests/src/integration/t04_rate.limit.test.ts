import { describe, it, expect, beforeEach } from 'vitest';
import { runExecutor, getRedis } from '../helpers/testUtils';
import type { UserContext, IntentGraph } from '../helpers/testUtils';

describe('Rate-limit guard → 4th call ⇢ delay', () => {
  let financeManagerUser: UserContext;
  let payrollGraph: IntentGraph;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = getRedis();
    
    financeManagerUser = {
      id: 'finance_user_001',
      roles: ['finance_manager'],
      permissions: ['payroll:read', 'payroll:write', 'finance:calculate']
    };

    payrollGraph = {
      apiVersion: 'intentive.dev/v1',
      kind: 'IntentGraph',
      metadata: {
        name: 'payroll-processing'
      },
      spec: {
        nodes: [
          { id: 'authenticate_user', type: 'action' },
          { id: 'check_approval_status', type: 'decision' },
          { id: 'fetch_employee_data', type: 'data' },
          { id: 'calculate_payroll', type: 'action' },
          { id: 'process_payments', type: 'action' }
        ],
        edges: [],
        guards: [
          {
            name: 'payroll_rbac',
            type: 'rbac',
            apply_to: {
              nodes: ['authenticate_user', 'check_approval_status', 'calculate_payroll', 'process_payments']
            },
            config: {
              required_roles: ['payroll_admin', 'finance_manager'],
              required_permissions: ['payroll:read', 'payroll:write', 'finance:calculate'],
              check_mode: 'strict',
              failure_action: 'block'
            }
          },
          {
            name: 'payment_rate_limit',
            type: 'rate_limit',
            apply_to: {
              nodes: ['process_payments']
            },
            config: {
              max_requests: 3,
              window_seconds: 3600,
              sliding_window: true,
              failure_action: 'delay'
            }
          }
        ],
        config: {}
      }
    };
  });

  it('allows first 3 requests to succeed', async () => {
    // Simulate 3 successful requests
    for (let i = 1; i <= 3; i++) {
      const result = await runExecutor(payrollGraph, financeManagerUser, {
        period: '2024-12',
        dry_run: false,
        requestNumber: i
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.nodesExecuted).toBe(5);
      expect(result.errors).toHaveLength(0);
    }
  });

  it('blocks 4th request and provides retry timing', async () => {
    // Simulate 3 successful requests first
    for (let i = 1; i <= 3; i++) {
      await runExecutor(payrollGraph, financeManagerUser, {
        period: '2024-12',
        dry_run: false,
        requestNumber: i
      });
    }

    // 4th request should be rate limited
    const result = await runExecutor(payrollGraph, financeManagerUser, {
      period: '2024-12',
      dry_run: false,
      requestNumber: 4
    });

    expect(result.status).toBe('DELAYED');
    expect(result.nodesExecuted).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Rate limit exceeded');
  });

  it('validates rate limit configuration', () => {
    const rateLimitGuard = payrollGraph.spec.guards.find((g: any) => g.name === 'payment_rate_limit');
    
    expect(rateLimitGuard).toBeDefined();
    expect(rateLimitGuard.type).toBe('rate_limit');
    expect(rateLimitGuard.config.max_requests).toBe(3);
    expect(rateLimitGuard.config.window_seconds).toBe(3600);
    expect(rateLimitGuard.config.sliding_window).toBe(true);
    expect(rateLimitGuard.config.failure_action).toBe('delay');
    expect(rateLimitGuard.apply_to.nodes).toContain('process_payments');
  });

  it('validates Redis mock is available', () => {
    expect(mockRedis).toBeDefined();
    expect(typeof mockRedis.get).toBe('function');
    expect(typeof mockRedis.set).toBe('function');
    expect(typeof mockRedis.incr).toBe('function');
  });
}); 