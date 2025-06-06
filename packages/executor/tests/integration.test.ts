import { TopologicalSorter } from '../src/TopologicalSorter';
import { ExecutionState } from '../src/ExecutionState';
import { NodeLifecycle } from '../src/NodeLifecycle';
import { ConfigLoader } from '../src/ConfigLoader';
import { ConcurrencyManager } from '../src/ConcurrencyManager';
import { IntentNode, IntentEdge, ExecutionConfig } from '../src/types';

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