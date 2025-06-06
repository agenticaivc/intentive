import { ExecutionResult, ExecutionContext, IntentGraph } from '../types';

export interface ExecutionStoreHook {
  onExecutionStart(executionId: string, context: ExecutionContext, graph: IntentGraph): Promise<void>;
  onExecutionComplete(executionId: string, result: ExecutionResult): Promise<void>;
  onExecutionFailed(executionId: string, error: Error): Promise<void>;
}

// Default implementation that does nothing (for backward compatibility)
export class NoOpExecutionStoreHook implements ExecutionStoreHook {
  async onExecutionStart(): Promise<void> {
    // No-op
  }
  
  async onExecutionComplete(): Promise<void> {
    // No-op
  }
  
  async onExecutionFailed(): Promise<void> {
    // No-op
  }
}

// Gateway implementation will be created separately to avoid circular dependencies
export let executionStoreHook: ExecutionStoreHook = new NoOpExecutionStoreHook();

export function setExecutionStoreHook(hook: ExecutionStoreHook): void {
  executionStoreHook = hook;
} 