import { describe, it, expect, beforeEach } from 'vitest';
import { runExecutor } from '../helpers/testUtils';
import type { UserContext, IntentGraph } from '../helpers/testUtils';

describe('RBAC guard → sales_rep blocked', () => {
  let salesRepUser: UserContext;
  let payrollGraph: IntentGraph;

  beforeEach(() => {
    salesRepUser = {
      id: 'sales_user_001',
      roles: ['sales_rep'],
      permissions: ['sales:read', 'sales:write']
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

  it('blocks sales_rep user from payroll operations', async () => {
    const result = await runExecutor(payrollGraph, salesRepUser, {
      period: '2024-12',
      dry_run: false
    });

    // Mock should return FAILED status for unauthorized user
    expect(result.status).toBe('FAILED');
    expect(result.nodesExecuted).toBe(0); // No nodes should execute
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('RBAC');
  });

  it('validates user lacks required roles', () => {
    const requiredRoles = ['payroll_admin', 'finance_manager'];
    const userRoles = salesRepUser.roles;
    
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    expect(hasRequiredRole).toBe(false);
  });

  it('validates user lacks required permissions', () => {
    const requiredPermissions = ['payroll:read', 'payroll:write', 'finance:calculate'];
    const userPermissions = salesRepUser.permissions;
    
    const hasAllPermissions = requiredPermissions.every(perm => userPermissions.includes(perm));
    expect(hasAllPermissions).toBe(false);
  });
}); 