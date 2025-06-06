export interface ConcurrencySlot {
  nodeId: string;
  startTime: Date;
  promise: Promise<unknown>;
}

export class ConcurrencyManager {
  private maxParallel: number;
  private runningSlots = new Map<string, ConcurrencySlot>();
  private waitingQueue: string[] = [];

  constructor(maxParallel: number) {
    if (maxParallel < 1) {
      throw new Error('maxParallel must be at least 1');
    }
    this.maxParallel = maxParallel;
  }

  /**
   * Check if there's capacity to run another node
   */
  hasCapacity(): boolean {
    return this.runningSlots.size < this.maxParallel;
  }

  /**
   * Get current number of running nodes
   */
  getCurrentLoad(): number {
    return this.runningSlots.size;
  }

  /**
   * Get available capacity
   */
  getAvailableCapacity(): number {
    return Math.max(0, this.maxParallel - this.runningSlots.size);
  }

  /**
   * Add a node to the running slots
   */
  addRunningNode(nodeId: string, promise: Promise<unknown>): void {
    if (this.runningSlots.has(nodeId)) {
      throw new Error(`Node ${nodeId} is already running`);
    }

    if (!this.hasCapacity()) {
      throw new Error(`Cannot start node ${nodeId}: concurrency limit (${this.maxParallel}) reached`);
    }

    const slot: ConcurrencySlot = {
      nodeId,
      startTime: new Date(),
      promise
    };

    this.runningSlots.set(nodeId, slot);

    // Set up cleanup when the promise completes
    promise
      .finally(() => {
        this.removeRunningNode(nodeId);
      })
      .catch(() => {
        // Errors are handled elsewhere, this is just for cleanup
      });
  }

  /**
   * Remove a node from running slots
   */
  removeRunningNode(nodeId: string): void {
    this.runningSlots.delete(nodeId);
  }

  /**
   * Check if a specific node is currently running
   */
  isNodeRunning(nodeId: string): boolean {
    return this.runningSlots.has(nodeId);
  }

  /**
   * Get all currently running node IDs
   */
  getRunningNodeIds(): string[] {
    return Array.from(this.runningSlots.keys());
  }

  /**
   * Get running slot information for a node
   */
  getRunningSlot(nodeId: string): ConcurrencySlot | undefined {
    return this.runningSlots.get(nodeId);
  }

  /**
   * Add node to waiting queue
   */
  addToWaitingQueue(nodeId: string): void {
    if (!this.waitingQueue.includes(nodeId)) {
      this.waitingQueue.push(nodeId);
    }
  }

  /**
   * Get next nodes from waiting queue that can be started
   */
  getNextFromQueue(): string[] {
    const availableCapacity = this.getAvailableCapacity();
    const nextNodes = this.waitingQueue.splice(0, availableCapacity);
    return nextNodes;
  }

  /**
   * Remove a node from waiting queue
   */
  removeFromWaitingQueue(nodeId: string): void {
    const index = this.waitingQueue.indexOf(nodeId);
    if (index !== -1) {
      this.waitingQueue.splice(index, 1);
    }
  }

  /**
   * Get current waiting queue
   */
  getWaitingQueue(): string[] {
    return [...this.waitingQueue];
  }

  /**
   * Wait for any running node to complete
   */
  async waitForAnyCompletion(): Promise<string> {
    if (this.runningSlots.size === 0) {
      throw new Error('No nodes are currently running');
    }

    const runningPromises = Array.from(this.runningSlots.entries()).map(
      ([nodeId, slot]) => 
        slot.promise.then(
          () => nodeId,
          () => nodeId // Return nodeId even on error
        )
    );

    return Promise.race(runningPromises);
  }

  /**
   * Wait for all running nodes to complete
   */
  async waitForAllCompletion(): Promise<void> {
    if (this.runningSlots.size === 0) {
      return;
    }

    const runningPromises = Array.from(this.runningSlots.values()).map(
      slot => slot.promise.catch(() => {}) // Ignore errors, just wait for completion
    );

    await Promise.all(runningPromises);
  }

  /**
   * Get concurrency statistics
   */
  getStats(): {
    maxParallel: number;
    currentLoad: number;
    availableCapacity: number;
    waitingCount: number;
    longestRunningDuration?: number;
  } {
    let longestRunningDuration: number | undefined;
    
    if (this.runningSlots.size > 0) {
      const now = new Date();
      longestRunningDuration = Math.max(
        ...Array.from(this.runningSlots.values()).map(
          slot => now.getTime() - slot.startTime.getTime()
        )
      );
    }

    return {
      maxParallel: this.maxParallel,
      currentLoad: this.getCurrentLoad(),
      availableCapacity: this.getAvailableCapacity(),
      waitingCount: this.waitingQueue.length,
      longestRunningDuration
    };
  }

  /**
   * Update maxParallel configuration (for dynamic adjustment)
   */
  updateMaxParallel(newMaxParallel: number): void {
    if (newMaxParallel < 1) {
      throw new Error('maxParallel must be at least 1');
    }

    const oldMaxParallel = this.maxParallel;
    this.maxParallel = newMaxParallel;

    // If we decreased the limit and are over it, we don't stop running nodes
    // but won't start new ones until we're under the limit
    if (newMaxParallel < oldMaxParallel && this.runningSlots.size > newMaxParallel) {
      console.warn(
        `Reduced maxParallel from ${oldMaxParallel} to ${newMaxParallel}, ` +
        `but ${this.runningSlots.size} nodes are still running. ` +
        `New nodes will be queued until capacity is available.`
      );
    }
  }

  /**
   * Clear all state (for cleanup)
   */
  clear(): void {
    this.runningSlots.clear();
    this.waitingQueue = [];
  }
} 