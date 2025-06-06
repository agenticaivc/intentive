import { NodeExecutionState, NodeExecutionStatus } from './types';

export class ExecutionState {
  private nodeStates = new Map<string, NodeExecutionState>();
  private nodeOutputs = new Map<string, unknown>();
  private globalContext = new Map<string, unknown>();

  /**
   * Initialize a node's execution state
   */
  initializeNode(nodeId: string): void {
    if (this.nodeStates.has(nodeId)) {
      throw new Error(`Node ${nodeId} is already initialized`);
    }

    this.nodeStates.set(nodeId, {
      nodeId,
      status: 'PENDING',
      retryCount: 0
    });
  }

  /**
   * Update a node's execution status
   */
  updateNodeStatus(nodeId: string, status: NodeExecutionStatus, error?: Error): void {
    const state = this.nodeStates.get(nodeId);
    if (!state) {
      throw new Error(`Node ${nodeId} is not initialized`);
    }

    const now = new Date();
    
    // Set start time when moving to RUNNING
    if (status === 'RUNNING' && state.status !== 'RUNNING') {
      state.startTime = now;
    }
    
    // Set end time when reaching terminal states
    if (['COMPLETE', 'FAILED', 'SKIPPED'].includes(status) && !state.endTime) {
      state.endTime = now;
    }

    state.status = status;
    
    if (error) {
      state.error = error;
    }

    this.nodeStates.set(nodeId, state);
  }

  /**
   * Store output from a completed node
   */
  setNodeOutput(nodeId: string, output: unknown): void {
    const state = this.nodeStates.get(nodeId);
    if (!state) {
      throw new Error(`Node ${nodeId} is not initialized`);
    }

    state.output = output;
    this.nodeOutputs.set(nodeId, output);
    this.nodeStates.set(nodeId, state);
  }

  /**
   * Get a node's current execution state
   */
  getNodeState(nodeId: string): NodeExecutionState | undefined {
    return this.nodeStates.get(nodeId);
  }

  /**
   * Get a node's output
   */
  getNodeOutput(nodeId: string): unknown {
    return this.nodeOutputs.get(nodeId);
  }

  /**
   * Check if a node has reached a specific status
   */
  isNodeInStatus(nodeId: string, status: NodeExecutionStatus): boolean {
    const state = this.nodeStates.get(nodeId);
    return state?.status === status;
  }

  /**
   * Get all nodes in a specific status
   */
  getNodesInStatus(status: NodeExecutionStatus): string[] {
    const result: string[] = [];
    for (const [nodeId, state] of this.nodeStates) {
      if (state.status === status) {
        result.push(nodeId);
      }
    }
    return result;
  }

  /**
   * Increment retry count for a node
   */
  incrementRetryCount(nodeId: string): number {
    const state = this.nodeStates.get(nodeId);
    if (!state) {
      throw new Error(`Node ${nodeId} is not initialized`);
    }

    state.retryCount++;
    this.nodeStates.set(nodeId, state);
    return state.retryCount;
  }

  /**
   * Set global context value (for data passing between nodes)
   */
  setGlobalContext(key: string, value: unknown): void {
    this.globalContext.set(key, value);
  }

  /**
   * Get global context value
   */
  getGlobalContext(key: string): unknown {
    return this.globalContext.get(key);
  }

  /**
   * Get all global context data
   */
  getAllGlobalContext(): Record<string, unknown> {
    return Object.fromEntries(this.globalContext);
  }

  /**
   * Get execution summary
   */
  getExecutionSummary(): {
    total: number;
    pending: number;
    ready: number;
    running: number;
    complete: number;
    failed: number;
    skipped: number;
  } {
    const summary = {
      total: this.nodeStates.size,
      pending: 0,
      ready: 0,
      running: 0,
      complete: 0,
      failed: 0,
      skipped: 0
    };

    for (const [, state] of this.nodeStates) {
      switch (state.status) {
        case 'PENDING':
          summary.pending++;
          break;
        case 'READY':
          summary.ready++;
          break;
        case 'RUNNING':
          summary.running++;
          break;
        case 'COMPLETE':
          summary.complete++;
          break;
        case 'FAILED':
          summary.failed++;
          break;
        case 'SKIPPED':
          summary.skipped++;
          break;
      }
    }

    return summary;
  }

  /**
   * Check if execution is complete (all nodes in terminal states)
   */
  isExecutionComplete(): boolean {
    for (const [, state] of this.nodeStates) {
      if (!['COMPLETE', 'FAILED', 'SKIPPED'].includes(state.status)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Reset state for a specific node (for retries)
   */
  resetNode(nodeId: string): void {
    const state = this.nodeStates.get(nodeId);
    if (!state) {
      throw new Error(`Node ${nodeId} is not initialized`);
    }

    state.status = 'PENDING';
    state.startTime = undefined;
    state.endTime = undefined;
    state.output = undefined;
    state.error = undefined;
    // Keep retry count for tracking

    this.nodeStates.set(nodeId, state);
    this.nodeOutputs.delete(nodeId);
  }

  /**
   * Clear all state (for cleanup)
   */
  clear(): void {
    this.nodeStates.clear();
    this.nodeOutputs.clear();
    this.globalContext.clear();
  }
} 