import { Guard, GuardCtx, GuardInput, GuardResult } from '../../packages/guards/src/GuardABI';

export class NoopGuard implements Guard {
  readonly name = 'noop';
  readonly type = 'custom' as const;

  async init(ctx: GuardCtx): Promise<void> {
    ctx.logger?.info(`Noop guard initialized for execution ${ctx.executionId}`);
  }

  async validate(i: GuardInput): Promise<GuardResult> {
    return {
      status: 'success',
      message: 'Noop guard validation passed',
      meta: {
        validatedAt: new Date().toISOString(),
        correlationId: i.correlationId
      }
    };
  }

  async execute(i: GuardInput): Promise<GuardResult> {
    return {
      status: 'success',
      message: 'Noop guard execution completed',
      meta: {
        executedAt: new Date().toISOString(),
        correlationId: i.correlationId
      }
    };
  }

  async cleanup(): Promise<void> {
    // Noop cleanup
  }
} 