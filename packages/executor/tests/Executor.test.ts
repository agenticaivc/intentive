import { Executor } from '../src/Executor';
import { IntentGraph, ExecutionContext } from '../src/types';

describe('Executor', () => {
  let executor: Executor;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn()
    };
    
    executor = new Executor({ logger: mockLogger });
  });

  describe('execute', () => {
    it('should execute a simple payroll graph successfully', async () => {
      const graph: IntentGraph = {
        apiVersion: 'intentive.dev/v1',
        kind: 'IntentGraph',
        metadata: {
          name: 'test-payroll',
          description: 'Test payroll workflow'
        },
        spec: {
          nodes: [
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
              id: 'calculate_payroll',
              type: 'action',
              properties: {
                name: 'Calculate Payroll',
                handler: 'payroll.calculate'
              }
            }
          ],
          edges: [
            {
              id: 'auth_to_approval',
              from: 'authenticate_user',
              to: 'verify_payroll_approval',
              type: 'sequence'
            },
            {
              id: 'approval_to_calculation',
              from: 'verify_payroll_approval',
              to: 'calculate_payroll',
              type: 'conditional',
              conditions: [
                {
                  field: 'approval',
                  operator: 'equals',
                  value: 'approved'
                }
              ]
            }
          ],
          guards: [],
          config: {
            timeout: 300,
            retry: {
              maxAttempts: 3,
              backoffMultiplier: 2
            },
            concurrency: {
              maxParallel: 2
            }
          }
        }
      };

      const context: ExecutionContext = {
        graphId: 'test-graph-1',
        executionId: 'exec-1',
        correlationId: 'corr-1',
        user: {
          id: 'user-1',
          roles: ['admin'],
          permissions: ['payroll:execute']
        },
        config: graph.spec.config,
        logger: mockLogger
      };

      const result = await executor.execute(graph, context);

      expect(result.success).toBe(true);
      expect(result.completedNodes).toHaveLength(3);
      expect(result.failedNodes).toHaveLength(0);
      expect(result.skippedNodes).toHaveLength(0);
      expect(result.executionTime).toBeGreaterThan(0);

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Execution started - graph: test-payroll, nodes: 3')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Execution complete')
      );
    });

    it('should handle graph with cycles', async () => {
      const graph: IntentGraph = {
        apiVersion: 'intentive.dev/v1',
        kind: 'IntentGraph',
        metadata: {
          name: 'cyclic-graph',
          description: 'Graph with cycles'
        },
        spec: {
          nodes: [
            {
              id: 'node1',
              type: 'action',
              properties: { name: 'Node 1', handler: 'test.handler' }
            },
            {
              id: 'node2',
              type: 'action',
              properties: { name: 'Node 2', handler: 'test.handler' }
            }
          ],
          edges: [
            {
              id: 'edge1',
              from: 'node1',
              to: 'node2',
              type: 'sequence'
            },
            {
              id: 'edge2',
              from: 'node2',
              to: 'node1',
              type: 'sequence'
            }
          ],
          guards: [],
          config: {
            concurrency: { maxParallel: 1 }
          }
        }
      };

      const context: ExecutionContext = {
        graphId: 'test-graph-2',
        executionId: 'exec-2',
        correlationId: 'corr-2',
        user: {
          id: 'user-1',
          roles: ['admin'],
          permissions: []
        },
        config: graph.spec.config
      };

      const result = await executor.execute(graph, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Graph contains cycles');
    });

    it('should respect maxParallel configuration', async () => {
      const graph: IntentGraph = {
        apiVersion: 'intentive.dev/v1',
        kind: 'IntentGraph',
        metadata: {
          name: 'parallel-test',
          description: 'Test parallel execution limits'
        },
        spec: {
          nodes: [
            {
              id: 'node1',
              type: 'action',
              properties: { name: 'Node 1', handler: 'test.handler' }
            },
            {
              id: 'node2',
              type: 'action',
              properties: { name: 'Node 2', handler: 'test.handler' }
            },
            {
              id: 'node3',
              type: 'action',
              properties: { name: 'Node 3', handler: 'test.handler' }
            }
          ],
          edges: [], // No dependencies, all can run in parallel
          guards: [],
          config: {
            concurrency: { maxParallel: 2 }
          }
        }
      };

      const context: ExecutionContext = {
        graphId: 'test-graph-3',
        executionId: 'exec-3',
        correlationId: 'corr-3',
        user: {
          id: 'user-1',
          roles: ['admin'],
          permissions: []
        },
        config: graph.spec.config
      };

      const result = await executor.execute(graph, context);

      expect(result.success).toBe(true);
      expect(result.completedNodes).toHaveLength(3);
      
      // Verify configuration was logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('maxParallel=2')
      );
    });

    it('should handle conditional edges correctly', async () => {
      const graph: IntentGraph = {
        apiVersion: 'intentive.dev/v1',
        kind: 'IntentGraph',
        metadata: {
          name: 'conditional-test',
          description: 'Test conditional edge evaluation'
        },
        spec: {
          nodes: [
            {
              id: 'decision_node',
              type: 'decision',
              properties: {
                name: 'Decision Node',
                handler: 'decision.handler'
              }
            },
            {
              id: 'conditional_node',
              type: 'action',
              properties: {
                name: 'Conditional Node',
                handler: 'action.handler'
              }
            }
          ],
          edges: [
            {
              id: 'conditional_edge',
              from: 'decision_node',
              to: 'conditional_node',
              type: 'conditional',
              conditions: [
                {
                  field: 'approval',
                  operator: 'equals',
                  value: 'approved'
                }
              ]
            }
          ],
          guards: [],
          config: {
            concurrency: { maxParallel: 1 }
          }
        }
      };

      const context: ExecutionContext = {
        graphId: 'test-graph-4',
        executionId: 'exec-4',
        correlationId: 'corr-4',
        user: {
          id: 'user-1',
          roles: ['admin'],
          permissions: []
        },
        config: graph.spec.config
      };

      const result = await executor.execute(graph, context);

      expect(result.success).toBe(true);
      expect(result.completedNodes).toContain('decision_node');
      expect(result.completedNodes).toContain('conditional_node');
    });

    it('should provide execution statistics', () => {
      const mockExecutionState = {
        getExecutionSummary: jest.fn().mockReturnValue({
          total: 5,
          pending: 1,
          ready: 1,
          running: 1,
          complete: 1,
          failed: 1,
          skipped: 0
        })
      };

      const stats = executor.getExecutionStats(mockExecutionState as any);

      expect(stats).toEqual({
        total: 5,
        pending: 1,
        ready: 1,
        running: 1,
        complete: 1,
        failed: 1,
        skipped: 0
      });
    });
  });
}); 