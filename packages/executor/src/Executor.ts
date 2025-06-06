import { IntentGraph, ExecutionContext, ExecutionResult, IntentNode } from './types';
import { TopologicalSorter } from './TopologicalSorter';
import { ExecutionState } from './ExecutionState';
import { NodeLifecycle } from './NodeLifecycle';
import { ConfigLoader, LoadedConfig } from './ConfigLoader';
import { ConcurrencyManager } from './ConcurrencyManager';
import { GraphQLFallback } from './graphql/GraphQLFallback';
import { cfg, isGraphQLEnabled } from './graphql/config';
import { logFallbackSkipped } from './graphql/logger';

export interface ExecutorOptions {
  logger?: typeof console;
}

export class Executor {
  private logger: typeof console;
  private graphqlFallback?: GraphQLFallback;

  constructor(options: ExecutorOptions = {}) {
    this.logger = options.logger || console;
    
    // Initialize GraphQL fallback if endpoint configured
    if (isGraphQLEnabled()) {
      try {
        this.graphqlFallback = new GraphQLFallback();
      } catch (error) {
        this.logger.warn(`GraphQL fallback initialization failed: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  /**
   * Execute an Intentive graph according to the execution semantics specification
   */
  async execute(graph: IntentGraph, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Execution started - graph: ${graph.metadata.name}, nodes: ${graph.spec.nodes.length}`);
      
      // Phase 1: Initialization
      const executionContext = await this.initializeExecution(graph, context);
      
      // Phase 2: Execution
      await this.executeGraph(executionContext);
      
      // Phase 3: Cleanup and Results
      const result = this.generateExecutionResult(executionContext, startTime, true);
      
      this.logger.info(`Execution complete - duration: ${result.executionTime}ms, success: ${result.completedNodes.length}, failed: ${result.failedNodes.length}`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Execution failed: ${error instanceof Error ? error.message : error}`);
      
      return {
        success: false,
        completedNodes: [],
        failedNodes: [],
        skippedNodes: [],
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Initialize execution context and validate graph
   */
  private async initializeExecution(graph: IntentGraph, context: ExecutionContext) {
    // Validate graph topology
    const sorter = new TopologicalSorter();
    const sortResult = sorter.sort(graph.spec.nodes, graph.spec.edges);
    
    if (!sortResult.hasValidTopology) {
      throw new Error(`Graph contains cycles: ${JSON.stringify(sortResult.cycles)}`);
    }
    
    // Load and validate configuration
    const config = ConfigLoader.loadCompleteConfig(graph.spec.config);
    ConfigLoader.validateRuntimeConfig(config);
    
    this.logger.info(ConfigLoader.getConfigSummary(config));
    
    // Initialize execution components
    const executionState = new ExecutionState();
    const nodeLifecycle = new NodeLifecycle(executionState);
    const concurrencyManager = new ConcurrencyManager(config.concurrency.maxParallel);
    
    // Initialize all nodes
    for (const node of graph.spec.nodes) {
      executionState.initializeNode(node.id);
    }
    
    return {
      graph,
      context,
      config,
      executionState,
      nodeLifecycle,
      concurrencyManager,
      sortedNodes: sortResult.sorted
    };
  }

  /**
   * Execute the graph using the execution semantics algorithm
   */
  private async executeGraph(executionContext: any): Promise<void> {
    const { graph, executionState, nodeLifecycle, concurrencyManager } = executionContext;
    
    while (!executionState.isExecutionComplete()) {
      // Find nodes ready for execution
      const readyNodes = nodeLifecycle.getReadyNodes(graph.spec.edges, graph.spec.nodes);
      
      // Start nodes within concurrency limits
      for (const nodeId of readyNodes) {
        if (concurrencyManager.hasCapacity()) {
          const promise = this.startNodeExecution(nodeId, executionContext);
          concurrencyManager.addRunningNode(nodeId, promise);
        } else {
          concurrencyManager.addToWaitingQueue(nodeId);
        }
      }
      
      // Wait for any completion if nodes are running
      if (concurrencyManager.getCurrentLoad() > 0) {
        await concurrencyManager.waitForAnyCompletion();
        
        // Process waiting queue
        const nextNodes = concurrencyManager.getNextFromQueue();
        for (const nodeId of nextNodes) {
          const promise = this.startNodeExecution(nodeId, executionContext);
          concurrencyManager.addRunningNode(nodeId, promise);
        }
      }
      
      // Safety check to prevent infinite loops
      const summary = executionState.getExecutionSummary();
      if (summary.pending === 0 && summary.ready === 0 && summary.running === 0) {
        break;
      }
    }
  }

  /**
   * Start execution of a single node
   */
  private async startNodeExecution(nodeId: string, executionContext: any): Promise<void> {
    const { graph, executionState, nodeLifecycle } = executionContext;
    
    try {
      // Transition to running
      nodeLifecycle.transitionNode(nodeId, 'RUNNING');
      this.logger.info(`Node running - ${nodeId}`);
      
      // Find the node definition
      const node = graph.spec.nodes.find((n: IntentNode) => n.id === nodeId);
      if (!node) {
        throw new Error(`Node definition not found: ${nodeId}`);
      }
      
      // Execute node handler (mock implementation for v0.1)
      const output = await this.executeNodeHandler(node, executionContext);
      
      // Store output and mark complete
      executionState.setNodeOutput(nodeId, output);
      nodeLifecycle.transitionNode(nodeId, 'COMPLETE');
      
      this.logger.info(`Node complete - ${nodeId}`);
      
    } catch (error) {
      // Mark as failed and skip downstream
      nodeLifecycle.transitionNode(nodeId, 'FAILED', error instanceof Error ? error : new Error(String(error)));
      nodeLifecycle.markDownstreamAsSkipped(nodeId, graph.spec.edges);
      
      this.logger.error(`Node failed - ${nodeId}, error: ${error instanceof Error ? error.message : error}`);
      
      // Emit execution_failed event (v0.1: just log)
      this.logger.error(`Execution failed event - nodeId: ${nodeId}, timestamp: ${new Date().toISOString()}`);
      
      // In v0.1, we stop execution on any failure
      throw error;
    }
  }

  /**
   * Mock node handler execution for v0.1
   * In production, this would delegate to actual node handlers
   */
  private async executeNodeHandler(node: IntentNode, executionContext: any): Promise<unknown> {
    // Check for injected failure (for CLI testing)
    if (node.properties && (node.properties as any).injectFailure === true) {
      throw new Error(`Injected test failure in node: ${node.id}`);
    }
    
    // NEW: GraphQL fallback integration
    if (this.shouldUseGraphQLFallback(node)) {
      try {
        return await this.graphqlFallback!.execute(node, executionContext.context);
      } catch (error) {
        this.logger.warn(`GraphQL fallback failed for ${node.id}, using mock: ${error instanceof Error ? error.message : error}`);
        // Fall through to existing mock behavior
      }
    }
    
    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    // Mock output based on node type
    switch (node.type) {
      case 'action':
        return { success: true, timestamp: new Date().toISOString() };
      case 'decision':
        // Return approval as a string to match the conditional edge expectations
        return { approval: 'approved', timestamp: new Date().toISOString() };
      case 'data':
        return { data: { processed: true }, count: 42, timestamp: new Date().toISOString() };
      default:
        return { result: 'completed' };
    }
  }

  /**
   * Determine if GraphQL fallback should be used for this node
   */
  private shouldUseGraphQLFallback(node: IntentNode): boolean {
    if (!this.graphqlFallback) {
      logFallbackSkipped(node.id, 'GraphQL fallback not initialized');
      return false;
    }
    
    // Use fallback if explicitly requested via handler or forced via config
    const shouldUse = node.properties.handler === 'graphql' || cfg.forceFallback;
    
    if (!shouldUse) {
      logFallbackSkipped(node.id, 'Handler not graphql and forceFallback=false');
    }
    
    return shouldUse;
  }

  /**
   * Generate final execution result
   */
  private generateExecutionResult(executionContext: any, startTime: number, success: boolean): ExecutionResult {
    const { executionState } = executionContext;
    
    return {
      success,
      completedNodes: executionState.getNodesInStatus('COMPLETE'),
      failedNodes: executionState.getNodesInStatus('FAILED'),
      skippedNodes: executionState.getNodesInStatus('SKIPPED'),
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Get execution statistics for monitoring
   */
  getExecutionStats(executionState: ExecutionState) {
    return executionState.getExecutionSummary();
  }
} 