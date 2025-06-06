import { ExecutionStoreHook } from '@intentive/executor/dist/hooks/executionStoreHook';
import { ExecutionResult, ExecutionContext, IntentGraph } from '@intentive/executor/dist/types';
import { getExecutionStore } from '../store/executionStore';
import { ExecutionRecord } from '../models/ExecutionRecord';

export class GatewayExecutionStoreHook implements ExecutionStoreHook {
  private store = getExecutionStore();

  async onExecutionStart(executionId: string, context: ExecutionContext, _graph: IntentGraph): Promise<void> {
    const record: ExecutionRecord = {
      id: executionId,
      createdAt: new Date(),
      status: 'running',
      graphId: context.graphId,
      correlationId: context.correlationId,
      userId: context.user.id
    };
    
    await this.store.upsert(record);
  }

  async onExecutionComplete(executionId: string, result: ExecutionResult): Promise<void> {
    const existing = await this.store.get(executionId);
    if (existing) {
      const updated: ExecutionRecord = {
        ...existing,
        status: 'completed',
        durationMs: result.executionTime,
        result: {
          success: result.success,
          completedNodes: result.completedNodes,
          failedNodes: result.failedNodes,
          skippedNodes: result.skippedNodes
        }
      };
      
      await this.store.upsert(updated);
    }
  }

  async onExecutionFailed(executionId: string, error: Error): Promise<void> {
    const existing = await this.store.get(executionId);
    if (existing) {
      const updated: ExecutionRecord = {
        ...existing,
        status: 'failed',
        durationMs: Date.now() - existing.createdAt.getTime(),
        error: error.message
      };
      
      await this.store.upsert(updated);
    }
  }
}
