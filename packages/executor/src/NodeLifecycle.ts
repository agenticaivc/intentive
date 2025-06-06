import { IntentNode, IntentEdge, NodeExecutionStatus, Condition } from './types';
import { ExecutionState } from './ExecutionState';

export interface DependencyCheckResult {
  isReady: boolean;
  pendingDependencies: string[];
  failedDependencies: string[];
}

export class NodeLifecycle {
  constructor(
    private executionState: ExecutionState
  ) {}

  /**
   * Check if a node is ready to execute based on its dependencies
   */
  checkNodeReadiness(
    nodeId: string, 
    edges: IntentEdge[], 
    allNodes: IntentNode[]
  ): DependencyCheckResult {
    const incomingEdges = edges.filter(edge => edge.to === nodeId);
    
    const pendingDependencies: string[] = [];
    const failedDependencies: string[] = [];

    for (const edge of incomingEdges) {
      const sourceNodeState = this.executionState.getNodeState(edge.from);
      
      if (!sourceNodeState) {
        throw new Error(`Source node ${edge.from} not found in execution state`);
      }

      // Check if source node has failed
      if (sourceNodeState.status === 'FAILED') {
        failedDependencies.push(edge.from);
        continue;
      }

      // Check if source node is complete and edge conditions are met
      if (sourceNodeState.status === 'COMPLETE') {
        const conditionsMet = this.evaluateEdgeConditions(edge, sourceNodeState.output);
        if (!conditionsMet) {
          // Conditions not met, treat as pending
          pendingDependencies.push(edge.from);
        }
      } else {
        // Source node not complete yet
        pendingDependencies.push(edge.from);
      }
    }

    // Node is ready if it has no pending dependencies and no failed dependencies
    // OR if it has no incoming edges (root node)
    const isReady = incomingEdges.length === 0 || 
                   (pendingDependencies.length === 0 && failedDependencies.length === 0);

    return {
      isReady,
      pendingDependencies,
      failedDependencies
    };
  }

  /**
   * Evaluate edge conditions based on source node output
   */
  private evaluateEdgeConditions(edge: IntentEdge, sourceOutput: unknown): boolean {
    if (!edge.conditions || edge.conditions.length === 0) {
      return true; // No conditions means always pass
    }

    for (const condition of edge.conditions) {
      if (!this.evaluateCondition(condition, sourceOutput)) {
        return false; // All conditions must pass
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition against data
   */
  private evaluateCondition(condition: Condition, data: unknown): boolean {
    const fieldValue = this.extractFieldValue(condition.field, data);
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      
      case 'not_equals':
        return fieldValue !== condition.value;
      
      case 'greater_than':
        return typeof fieldValue === 'number' && 
               typeof condition.value === 'number' && 
               fieldValue > condition.value;
      
      case 'less_than':
        return typeof fieldValue === 'number' && 
               typeof condition.value === 'number' && 
               fieldValue < condition.value;
      
      case 'in':
        return Array.isArray(condition.value) && 
               condition.value.includes(fieldValue);
      
      case 'contains':
        return typeof fieldValue === 'string' && 
               typeof condition.value === 'string' && 
               fieldValue.includes(condition.value);
      
      case 'within_hours':
        return this.isWithinHours(fieldValue, condition.value);
      
      default:
        throw new Error(`Unsupported condition operator: ${condition.operator}`);
    }
  }

  /**
   * Extract field value from data using dot notation
   */
  private extractFieldValue(field: string, data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    const parts = field.split('.');
    let current: any = data;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Check if a timestamp is within specified hours
   */
  private isWithinHours(fieldValue: unknown, hours: unknown): boolean {
    if (typeof hours !== 'number') {
      return false;
    }

    let timestamp: Date;
    
    if (fieldValue instanceof Date) {
      timestamp = fieldValue;
    } else if (typeof fieldValue === 'string') {
      timestamp = new Date(fieldValue);
      if (isNaN(timestamp.getTime())) {
        return false;
      }
    } else {
      return false;
    }

    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return diffHours <= hours;
  }

  /**
   * Transition a node to the next appropriate state
   */
  transitionNode(nodeId: string, newStatus: NodeExecutionStatus, error?: Error): void {
    const currentState = this.executionState.getNodeState(nodeId);
    if (!currentState) {
      throw new Error(`Node ${nodeId} not found in execution state`);
    }

    // Validate state transition
    if (!this.isValidTransition(currentState.status, newStatus)) {
      throw new Error(
        `Invalid state transition for node ${nodeId}: ${currentState.status} -> ${newStatus}`
      );
    }

    this.executionState.updateNodeStatus(nodeId, newStatus, error);
  }

  /**
   * Validate if a state transition is allowed
   */
  private isValidTransition(from: NodeExecutionStatus, to: NodeExecutionStatus): boolean {
    const validTransitions: Record<NodeExecutionStatus, NodeExecutionStatus[]> = {
      'PENDING': ['READY', 'SKIPPED'],
      'READY': ['RUNNING', 'SKIPPED'],
      'RUNNING': ['COMPLETE', 'FAILED'],
      'COMPLETE': [], // Terminal state
      'FAILED': ['READY'], // Can retry
      'SKIPPED': [] // Terminal state
    };

    return validTransitions[from].includes(to);
  }

  /**
   * Mark downstream nodes as skipped when a dependency fails
   */
  markDownstreamAsSkipped(failedNodeId: string, edges: IntentEdge[]): void {
    const downstreamNodes = this.findDownstreamNodes(failedNodeId, edges);
    
    for (const nodeId of downstreamNodes) {
      const currentState = this.executionState.getNodeState(nodeId);
      if (currentState && ['PENDING', 'READY'].includes(currentState.status)) {
        this.executionState.updateNodeStatus(nodeId, 'SKIPPED');
      }
    }
  }

  /**
   * Find all nodes downstream from a given node
   */
  private findDownstreamNodes(startNodeId: string, edges: IntentEdge[]): Set<string> {
    const downstream = new Set<string>();
    const queue = [startNodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      if (visited.has(currentNodeId)) {
        continue;
      }
      visited.add(currentNodeId);

      // Find all edges where current node is the source
      const outgoingEdges = edges.filter(edge => edge.from === currentNodeId);
      
      for (const edge of outgoingEdges) {
        downstream.add(edge.to);
        queue.push(edge.to);
      }
    }

    return downstream;
  }

  /**
   * Get all nodes that are ready to execute
   */
  getReadyNodes(edges: IntentEdge[], allNodes: IntentNode[]): string[] {
    const readyNodes: string[] = [];
    const pendingNodes = this.executionState.getNodesInStatus('PENDING');

    for (const nodeId of pendingNodes) {
      const readinessCheck = this.checkNodeReadiness(nodeId, edges, allNodes);
      
      if (readinessCheck.isReady) {
        readyNodes.push(nodeId);
      } else if (readinessCheck.failedDependencies.length > 0) {
        // Skip nodes with failed dependencies
        this.executionState.updateNodeStatus(nodeId, 'SKIPPED');
      }
    }

    // Mark ready nodes as READY
    for (const nodeId of readyNodes) {
      this.executionState.updateNodeStatus(nodeId, 'READY');
    }

    return readyNodes;
  }
} 