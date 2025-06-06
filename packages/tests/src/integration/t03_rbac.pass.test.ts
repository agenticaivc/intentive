import { describe, it, expect, beforeEach } from 'vitest';
import { runExecutor } from '../helpers/testUtils';
import type { UserContext, IntentGraph } from '../helpers/testUtils';

describe('RBAC guard → finance_manager passes', () => {
  let financeManagerUser: UserContext;
  let payrollGraph: IntentGraph;

  beforeEach(() => {
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
          }
        ],
        config: {}
      }
    };
  });

  it('allows finance_manager user to execute payroll operations', async () => {
    const result = await runExecutor(payrollGraph, financeManagerUser, {
      period: '2024-12',
      dry_run: false
    });

    // Mock should return SUCCESS status for authorized user
    expect(result.status).toBe('SUCCESS');
    expect(result.nodesExecuted).toBe(5); // All nodes should execute
    expect(result.errors).toHaveLength(0);
  });

  it('validates user has required roles', () => {
    const requiredRoles = ['payroll_admin', 'finance_manager'];
    const userRoles = financeManagerUser.roles;
    
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    expect(hasRequiredRole).toBe(true);
    expect(userRoles).toContain('finance_manager');
  });

  it('validates user has required permissions', () => {
    const requiredPermissions = ['payroll:read', 'payroll:write', 'finance:calculate'];
    const userPermissions = financeManagerUser.permissions;
    
    const hasAllPermissions = requiredPermissions.every(perm => userPermissions.includes(perm));
    expect(hasAllPermissions).toBe(true);
  });

  it('validates RBAC guard configuration', () => {
    const rbacGuard = payrollGraph.spec.guards.find((g: any) => g.name === 'payroll_rbac');
    
    expect(rbacGuard).toBeDefined();
    expect(rbacGuard.type).toBe('rbac');
    expect(rbacGuard.config.failure_action).toBe('block');
    expect(rbacGuard.config.check_mode).toBe('strict');
    expect(rbacGuard.apply_to.nodes).toContain('authenticate_user');
  });
}); 