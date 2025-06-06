import { describe, it, expect, beforeEach } from 'vitest';
import { createPerformanceTracker, runExecutor, logCIHealth } from '../helpers/testUtils';
import type { UserContext, IntentGraph } from '../helpers/testUtils';

describe('End-to-end payroll happy path', () => {
  let financeManagerUser: UserContext;
  let payrollGraph: IntentGraph;
  let performanceTracker: ReturnType<typeof createPerformanceTracker>;

  beforeEach(() => {
    // Log CI health for debugging
    logCIHealth();
    
    performanceTracker = createPerformanceTracker();
    
    financeManagerUser = {
      id: 'finance_user_001',
      roles: ['finance_manager'],
      permissions: ['payroll:read', 'payroll:write', 'finance:calculate']
    };

    payrollGraph = {
      apiVersion: 'intentive.dev/v1',
      kind: 'IntentGraph',
      metadata: {
        name: 'payroll-processing',
        description: 'Simplified 5-node payroll processing for golden-path testing'
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
        guards: [],
        config: {}
      }
    };
  });

  it('completes finance_manager payroll run < 6s', async () => {
    // Use performance.mark/measure for DevTools integration
    performance.mark('start-e2e');
    
    const result = await runExecutor(payrollGraph, financeManagerUser, {
      period: '2024-12',
      dry_run: false
    });
    
    performance.measure('payroll-e2e', 'start-e2e');
    const { duration } = performance.getEntriesByName('payroll-e2e')[0];
    
    expect(result.status).toBe('SUCCESS');
    expect(duration).toBeLessThan(6000); // < 6 seconds
    expect(result.nodesExecuted).toBe(5);
    expect(result.errors).toHaveLength(0);
    
    // Log for CI summary
    console.log(`⏱️  E2E execution time: ${duration.toFixed(2)}ms`);
  });

  it('validates all expected nodes are present', async () => {
    const expectedNodes = [
      'authenticate_user',
      'check_approval_status', 
      'fetch_employee_data',
      'calculate_payroll',
      'process_payments'
    ];

    expect(payrollGraph.spec.nodes).toHaveLength(expectedNodes.length);
    
    const nodeIds = payrollGraph.spec.nodes.map((node: any) => node.id);
    expectedNodes.forEach(nodeId => {
      expect(nodeIds).toContain(nodeId);
    });
  });
}); 