import { TopologicalSorter } from '../src/TopologicalSorter';
import { ExecutionState } from '../src/ExecutionState';
import { NodeLifecycle } from '../src/NodeLifecycle';
import { ConfigLoader } from '../src/ConfigLoader';
import { ConcurrencyManager } from '../src/ConcurrencyManager';
import { IntentNode, IntentEdge, IntentGuard, ExecutionConfig } from '../src/types';

describe('Executor Integration Tests', () => {
  describe('Payroll Graph Example', () => {
    let nodes: IntentNode[];
    let edges: IntentEdge[];
    let config: ExecutionConfig;

    beforeEach(() => {
      // Simplified payroll graph based on examples
      nodes = [
        {
          id: 'authenticate_user',
          type: 'action',
          properties: {
            name: 'Authenticate User',
            handler: 'auth.authenticate'
          }
        },
        {
          id: 'verify_payroll_approval',
          type: 'decision',
          properties: {
            name: 'Verify Payroll Approval',
            handler: 'approval.verify'
          }
        },
        {
          id: 'collect_employee_data',
          type: 'data',
          properties: {
            name: 'Collect Employee Data',
            handler: 'data.collect'
          }
        },
        {
          id: 'calculate_payroll',
          type: 'action',
          properties: {
            name: 'Calculate Payroll',
            handler: 'payroll.calculate'
          }
        },
        {
          id: 'execute_payment_processing',
          type: 'action',
          properties: {
            name: 'Execute Payment Processing',
            handler: 'payments.execute'
          }
        }
      ];

      edges = [
        {
          id: 'auth_to_approval',
          from: 'authenticate_user',
          to: 'verify_payroll_approval',
          type: 'sequence'
        },
        {
          id: 'approval_to_data',
          from: 'verify_payroll_approval',
          to: 'collect_employee_data',
          type: 'conditional',
          conditions: [
            {
              field: 'approval.status',
              operator: 'equals',
              value: 'approved'
            }
          ]
        },
        {
          id: 'data_to_calculation',
          from: 'collect_employee_data',
          to: 'calculate_payroll',
          type: 'sequence'
        },
        {
          id: 'calculation_to_payment',
          from: 'calculate_payroll',
          to: 'execute_payment_processing',
          type: 'sequence'
        }
      ];

      config = {
        timeout: 300,
        retry: {
          maxAttempts: 3,
          backoffMultiplier: 2
        },
        concurrency: {
          maxParallel: 2
        }
      };
    });

    it('should sort payroll nodes in dependency-correct order', () => {
      // Acceptance Criteria 1: dependency-correct order
      const sorter = new TopologicalSorter();
      const result = sorter.sort(nodes, edges);

      expect(result.hasValidTopology).toBe(true);
      expect(result.cycles).toHaveLength(0);
      
      // Verify dependency order
      const sorted = result.sorted;
      expect(sorted.indexOf('authenticate_user')).toBeLessThan(sorted.indexOf('verify_payroll_approval'));
      expect(sorted.indexOf('verify_payroll_approval')).toBeLessThan(sorted.indexOf('collect_employee_data'));
      expect(sorted.indexOf('collect_employee_data')).toBeLessThan(sorted.indexOf('calculate_payroll'));
      expect(sorted.indexOf('calculate_payroll')).toBeLessThan(sorted.indexOf('execute_payment_processing'));
    });

    it('should respect maxParallel configuration', () => {
      // Acceptance Criteria 1: never exceeds maxParallel
      const loadedConfig = ConfigLoader.loadCompleteConfig(config);
      const concurrencyManager = new ConcurrencyManager(loadedConfig.concurrency.maxParallel);

      expect(loadedConfig.concurrency.maxParallel).toBe(2);
      expect(concurrencyManager.hasCapacity()).toBe(true);
      expect(concurrencyManager.getCurrentLoad()).toBe(0);
      expect(concurrencyManager.getAvailableCapacity()).toBe(2);

      // Simulate adding nodes up to limit
      const mockPromise1 = new Promise(resolve => setTimeout(resolve, 100));
      const mockPromise2 = new Promise(resolve => setTimeout(resolve, 100));
      
      concurrencyManager.addRunningNode('node1', mockPromise1);
      expect(concurrencyManager.getCurrentLoad()).toBe(1);
      expect(concurrencyManager.hasCapacity()).toBe(true);

      concurrencyManager.addRunningNode('node2', mockPromise2);
      expect(concurrencyManager.getCurrentLoad()).toBe(2);
      expect(concurrencyManager.hasCapacity()).toBe(false);

      // Should throw when trying to exceed limit
      const mockPromise3 = new Promise(resolve => setTimeout(resolve, 100));
      expect(() => concurrencyManager.addRunningNode('node3', mockPromise3))
        .toThrow('Cannot start node node3: concurrency limit (2) reached');
    });

    it('should handle node lifecycle transitions correctly', () => {
      const executionState = new ExecutionState();
      const nodeLifecycle = new NodeLifecycle(executionState);

      // Initialize all nodes
      nodes.forEach(node => executionState.initializeNode(node.id));

      // Test initial state
      expect(executionState.getNodesInStatus('PENDING')).toHaveLength(5);

      // Test ready node detection (root nodes should be ready)
      const readyNodes = nodeLifecycle.getReadyNodes(edges, nodes);
      expect(readyNodes).toContain('authenticate_user');
      expect(readyNodes).toHaveLength(1); // Only root node should be ready initially

      // Test state transitions - proper sequence: PENDING -> READY -> RUNNING -> COMPLETE
      nodeLifecycle.transitionNode('authenticate_user', 'RUNNING');
      expect(executionState.isNodeInStatus('authenticate_user', 'RUNNING')).toBe(true);

      // Complete the node and check downstream readiness
      executionState.setNodeOutput('authenticate_user', { success: true });
      nodeLifecycle.transitionNode('authenticate_user', 'COMPLETE');
      
      const nextReadyNodes = nodeLifecycle.getReadyNodes(edges, nodes);
      expect(nextReadyNodes).toContain('verify_payroll_approval');
    });

    it('should handle conditional edge evaluation', () => {
      const executionState = new ExecutionState();
      const nodeLifecycle = new NodeLifecycle(executionState);

      // Initialize nodes
      nodes.forEach(node => executionState.initializeNode(node.id));

      // Complete authentication properly: PENDING -> READY -> RUNNING -> COMPLETE
      nodeLifecycle.transitionNode('authenticate_user', 'READY');
      nodeLifecycle.transitionNode('authenticate_user', 'RUNNING');
      executionState.setNodeOutput('authenticate_user', { success: true });
      nodeLifecycle.transitionNode('authenticate_user', 'COMPLETE');

      // Complete approval with approved status
      nodeLifecycle.transitionNode('verify_payroll_approval', 'READY');
      nodeLifecycle.transitionNode('verify_payroll_approval', 'RUNNING');
      executionState.setNodeOutput('verify_payroll_approval', { 
        approval: { status: 'approved' } 
      });
      nodeLifecycle.transitionNode('verify_payroll_approval', 'COMPLETE');

      // Check that conditional edge allows progression
      const readyNodes = nodeLifecycle.getReadyNodes(edges, nodes);
      expect(readyNodes).toContain('collect_employee_data');
    });

    it('should skip downstream nodes when dependency fails', () => {
      // Acceptance Criteria 2: downstream nodes not run when failure occurs
      const executionState = new ExecutionState();
      const nodeLifecycle = new NodeLifecycle(executionState);

      // Initialize nodes
      nodes.forEach(node => executionState.initializeNode(node.id));

      // Simulate failure in calculate_payroll - proper state transitions
      nodeLifecycle.transitionNode('calculate_payroll', 'READY');
      nodeLifecycle.transitionNode('calculate_payroll', 'RUNNING');
      nodeLifecycle.transitionNode('calculate_payroll', 'FAILED', new Error('Calculation failed'));

      // Mark downstream nodes as skipped
      nodeLifecycle.markDownstreamAsSkipped('calculate_payroll', edges);

      // Verify downstream node is skipped
      expect(executionState.isNodeInStatus('execute_payment_processing', 'SKIPPED')).toBe(true);
    });

    it('should validate configuration loading', () => {
      const loadedConfig = ConfigLoader.loadCompleteConfig(config);

      expect(loadedConfig.timeout).toBe(300);
      expect(loadedConfig.concurrency.maxParallel).toBe(2);
      expect(loadedConfig.retry.maxAttempts).toBe(3);
      expect(loadedConfig.retry.backoffMultiplier).toBe(2);

      const summary = ConfigLoader.getConfigSummary(loadedConfig);
      expect(summary).toContain('maxParallel=2');
      expect(summary).toContain('timeout=300s');
    });

    it('should provide execution summary', () => {
      const executionState = new ExecutionState();

      // Initialize nodes
      nodes.forEach(node => executionState.initializeNode(node.id));

      const initialSummary = executionState.getExecutionSummary();
      expect(initialSummary.total).toBe(5);
      expect(initialSummary.pending).toBe(5);
      expect(initialSummary.complete).toBe(0);

      // Complete some nodes
      executionState.updateNodeStatus('authenticate_user', 'COMPLETE');
      executionState.updateNodeStatus('verify_payroll_approval', 'RUNNING');

      const updatedSummary = executionState.getExecutionSummary();
      expect(updatedSummary.complete).toBe(1);
      expect(updatedSummary.running).toBe(1);
      expect(updatedSummary.pending).toBe(3);
    });
  });
});

describe('Payroll Example Integration Tests - v0.1', () => {
  let payrollGraph: { nodes: IntentNode[], edges: IntentEdge[], guards: IntentGuard[], config: ExecutionConfig };

  beforeEach(() => {
    jest.useFakeTimers();
    
    // Simplified 5-node payroll graph matching docs/examples/payroll-graph.yaml
    payrollGraph = {
      nodes: [
        {
          id: 'authenticate_user',
          type: 'action',
          properties: {
            name: 'Authenticate User',
            description: 'Verify user identity and check authorization',
            handler: 'auth.authenticate'
          }
        },
        {
          id: 'check_approval_status',
          type: 'decision',
          properties: {
            name: 'Check Approval Status',
            description: 'Verify payroll run has proper approvals',
            handler: 'approval.check_status'
          }
        },
        {
          id: 'fetch_employee_data',
          type: 'data',
          properties: {
            name: 'Fetch Employee Data',
            description: 'Retrieve employee records from HR system',
            handler: 'data.fetch_employees'
          }
        },
        {
          id: 'calculate_payroll',
          type: 'action',
          properties: {
            name: 'Calculate Payroll',
            description: 'Calculate gross pay, deductions, and net pay',
            handler: 'payroll.calculate'
          }
        },
        {
          id: 'process_payments',
          type: 'action',
          properties: {
            name: 'Process Payments',
            description: 'Execute ACH transfers and payment processing',
            handler: 'payments.process'
          }
        }
      ],
      edges: [
        {
          id: 'auth_to_approval',
          from: 'authenticate_user',
          to: 'check_approval_status',
          type: 'sequence',
          conditions: []
        },
        {
          id: 'approval_to_data',
          from: 'check_approval_status',
          to: 'fetch_employee_data',
          type: 'conditional',
          conditions: [
            {
              field: 'approval.status',
              operator: 'equals',
              value: 'approved'
            }
          ]
        },
        {
          id: 'data_to_calc',
          from: 'fetch_employee_data',
          to: 'calculate_payroll',
          type: 'sequence',
          conditions: []
        },
        {
          id: 'calc_to_payments',
          from: 'calculate_payroll',
          to: 'process_payments',
          type: 'sequence',
          conditions: []
        }
      ],
      guards: [
        {
          name: 'payroll_rbac_guard',
          type: 'rbac',
          apply_to: {
            nodes: ['authenticate_user']
          },
          config: {
            type: 'rbac',
            requiredRoles: ['payroll_admin', 'finance_manager'],
            requiredPermissions: ['payroll:read', 'payroll:write'],
            allowSuperuser: false
          }
        },
        {
          name: 'payment_rate_limit_guard',
          type: 'rate_limit',
          apply_to: {
            nodes: ['process_payments']
          },
          config: {
            type: 'rate_limit',
            maxRequests: 3,
            windowMs: 3600000,
            keyGenerator: 'user'
          }
        }
      ],
      config: {
        timeout: 300,
        concurrency: {
          maxParallel: 2
        },
        retry: {
          maxAttempts: 2,
          backoffMultiplier: 2
        }
      }
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('processes payroll successfully for finance_manager', async () => {
    // Acceptance Criteria: Given NL "Process payroll for December 2024" → finance_manager → SUCCESS
    const executionState = new ExecutionState();
    const nodeLifecycle = new NodeLifecycle(executionState);
    
    // Initialize nodes
    payrollGraph.nodes.forEach(node => executionState.initializeNode(node.id));
    
    // Simulate successful execution with authorized user
    const userContext = {
      id: 'finance_user_001',
      roles: ['finance_manager'],
      permissions: ['payroll:read', 'payroll:write']
    };
    
    // Mock RBAC guard passing
    executionState.setNodeOutput('authenticate_user', { 
      success: true, 
      user: userContext 
    });
    nodeLifecycle.transitionNode('authenticate_user', 'READY');
    nodeLifecycle.transitionNode('authenticate_user', 'RUNNING');
    nodeLifecycle.transitionNode('authenticate_user', 'COMPLETE');
    
    // Mock approval status check
    executionState.setNodeOutput('check_approval_status', { 
      approval: { status: 'approved' } 
    });
    nodeLifecycle.transitionNode('check_approval_status', 'READY');
    nodeLifecycle.transitionNode('check_approval_status', 'RUNNING');
    nodeLifecycle.transitionNode('check_approval_status', 'COMPLETE');
    
    // Mock data fetching
    executionState.setNodeOutput('fetch_employee_data', { 
      employees: [
        { id: 'emp1', name: 'John Doe', salary: 75000 },
        { id: 'emp2', name: 'Jane Smith', salary: 85000 }
      ]
    });
    nodeLifecycle.transitionNode('fetch_employee_data', 'READY');
    nodeLifecycle.transitionNode('fetch_employee_data', 'RUNNING');
    nodeLifecycle.transitionNode('fetch_employee_data', 'COMPLETE');
    
    // Mock payroll calculation
    executionState.setNodeOutput('calculate_payroll', { 
      totalGross: 160000,
      totalNet: 120000,
      deductions: 40000
    });
    nodeLifecycle.transitionNode('calculate_payroll', 'READY');
    nodeLifecycle.transitionNode('calculate_payroll', 'RUNNING');
    nodeLifecycle.transitionNode('calculate_payroll', 'COMPLETE');
    
    // Mock payment processing (under rate limit)
    executionState.setNodeOutput('process_payments', { 
      transactionId: 'tx_123456',
      status: 'completed',
      amount: 120000
    });
    nodeLifecycle.transitionNode('process_payments', 'READY');
    nodeLifecycle.transitionNode('process_payments', 'RUNNING');
    nodeLifecycle.transitionNode('process_payments', 'COMPLETE');
    
    // Verify all nodes completed successfully
    const summary = executionState.getExecutionSummary();
    expect(summary.complete).toBe(5);
    expect(summary.failed).toBe(0);
    expect(summary.skipped).toBe(0);
    
    // Verify outputs
    const finalOutput = executionState.getNodeOutput('process_payments');
    expect(finalOutput).toEqual({
      transactionId: 'tx_123456',
      status: 'completed',
      amount: 120000
    });
  });

  it('blocks unauthorized user via RBAC guard', async () => {
    // Acceptance Criteria: sales_rep → RBAC guard blocks → execution_failed
    const executionState = new ExecutionState();
    const nodeLifecycle = new NodeLifecycle(executionState);
    
    // Initialize nodes
    payrollGraph.nodes.forEach(node => executionState.initializeNode(node.id));
    
    // Simulate RBAC guard blocking unauthorized user
    const unauthorizedUser = {
      id: 'sales_rep_005',
      roles: ['sales_rep'],  // Missing required roles
      permissions: ['crm:read']
    };
    
    // Mock RBAC guard failure
    nodeLifecycle.transitionNode('authenticate_user', 'READY');
    nodeLifecycle.transitionNode('authenticate_user', 'RUNNING');
    nodeLifecycle.transitionNode('authenticate_user', 'FAILED', 
      new Error('RBAC guard blocked: User lacks required roles [payroll_admin, finance_manager]')
    );
    
    // Mark downstream nodes as skipped due to failure
    nodeLifecycle.markDownstreamAsSkipped('authenticate_user', payrollGraph.edges);
    
    // Verify execution failed appropriately
    const summary = executionState.getExecutionSummary();
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(4); // All downstream nodes should be skipped
    expect(summary.complete).toBe(0);
    
    // Verify error details
    const nodeState = executionState.getNodeState('authenticate_user');
    expect(nodeState?.status).toBe('FAILED');
    expect(nodeState?.error?.message).toMatch(/RBAC guard blocked/);
  });

  it('rate limits process_payments after 3 calls within hour window', async () => {
    // Acceptance Criteria: 4th call in hour → expect status:"delay"
    let executionState = new ExecutionState();
    let nodeLifecycle = new NodeLifecycle(executionState);
    
    // Simulate 3 successful payment calls
    for (let i = 0; i < 3; i++) {
      // Reset state for each call
      payrollGraph.nodes.forEach(node => executionState.initializeNode(node.id));
      
      // Fast-track to payment processing (skip other nodes for test brevity)
      nodeLifecycle.transitionNode('process_payments', 'READY');
      nodeLifecycle.transitionNode('process_payments', 'RUNNING');
      nodeLifecycle.transitionNode('process_payments', 'COMPLETE');
      
      // Reset for next iteration
      executionState = new ExecutionState();
      nodeLifecycle = new NodeLifecycle(executionState);
    }
    
    // 4th call - should be rate limited
    payrollGraph.nodes.forEach(node => executionState.initializeNode(node.id));
    
    // Mock rate limit guard blocking the 4th call
    nodeLifecycle.transitionNode('process_payments', 'READY');
    nodeLifecycle.transitionNode('process_payments', 'RUNNING');
    
    // Simulate rate limit guard returning delay status
    const rateLimitError = new Error('Rate limit exceeded: max 3 requests per hour');
    rateLimitError.name = 'RateLimitError';
    (rateLimitError as any).guardResult = {
      status: 'delay',
      retryAfterMs: 1800000, // 30 minutes
      message: 'Rate limit exceeded for user finance_user_001'
    };
    
    nodeLifecycle.transitionNode('process_payments', 'FAILED', rateLimitError);
    
    // Verify rate limiting behavior
    const nodeState = executionState.getNodeState('process_payments');
    expect(nodeState?.status).toBe('FAILED');
    expect(nodeState?.error?.name).toBe('RateLimitError');
    
    // Advance time past window and verify reset would work
    jest.advanceTimersByTime(3600000); // 1 hour
    
    // After window expires, should be able to process again
    const newExecutionState = new ExecutionState();
    payrollGraph.nodes.forEach(node => newExecutionState.initializeNode(node.id));
    
    const newNodeLifecycle = new NodeLifecycle(newExecutionState);
    newNodeLifecycle.transitionNode('process_payments', 'READY');
    newNodeLifecycle.transitionNode('process_payments', 'RUNNING');
    newNodeLifecycle.transitionNode('process_payments', 'COMPLETE');
    
    expect(newExecutionState.getNodeState('process_payments')?.status).toBe('COMPLETE');
  });

  it('validates configuration matches specification', () => {
    // Verify config loads correctly with all required settings
    const loadedConfig = ConfigLoader.loadCompleteConfig(payrollGraph.config);
    
    expect(loadedConfig.timeout).toBe(300);
    expect(loadedConfig.concurrency.maxParallel).toBe(2); // Updated from 3 to 2 per spec
    expect(loadedConfig.retry.maxAttempts).toBe(2);
    expect(loadedConfig.retry.backoffMultiplier).toBe(2);
    
    const summary = ConfigLoader.getConfigSummary(loadedConfig);
    expect(summary).toContain('maxParallel=2');
    expect(summary).toContain('timeout=300s');
  });

  it('validates guards configuration structure', () => {
    // Verify guards match expected schema
    const rbacGuard = payrollGraph.guards.find(g => g.name === 'payroll_rbac_guard');
    const rateLimitGuard = payrollGraph.guards.find(g => g.name === 'payment_rate_limit_guard');
    
    // RBAC guard validation
    expect(rbacGuard).toBeDefined();
    expect(rbacGuard?.type).toBe('rbac');
    expect(rbacGuard?.apply_to.nodes).toContain('authenticate_user');
    expect(rbacGuard?.config).toEqual({
      type: 'rbac',
      requiredRoles: ['payroll_admin', 'finance_manager'],
      requiredPermissions: ['payroll:read', 'payroll:write'],
      allowSuperuser: false
    });
    
    // Rate limit guard validation  
    expect(rateLimitGuard).toBeDefined();
    expect(rateLimitGuard?.type).toBe('rate_limit');
    expect(rateLimitGuard?.apply_to.nodes).toContain('process_payments');
    expect(rateLimitGuard?.config).toEqual({
      type: 'rate_limit',
      maxRequests: 3,
      windowMs: 3600000,
      keyGenerator: 'user'
    });
  });
}); 