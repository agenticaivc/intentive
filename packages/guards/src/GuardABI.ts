export interface GuardCtx {
  correlationId: string;
  graphId: string;
  executionId: string;
  logger?: typeof console;
}

export interface GuardInput {
  correlationId: string;
  user: { id: string; roles: string[]; permissions: string[] };
  nodeOrEdgeId: string;
  parameters: Record<string, unknown>;
  priorResults: Record<string, unknown>;
}

export type GuardStatus = "success" | "block" | "delay" | "warn";

export interface GuardResult {
  status: GuardStatus;
  message?: string;
  retryAfterMs?: number;            // only for "delay"
  meta?: Record<string, unknown>;
}

export interface Guard {
  /** name must match guards[].name in YAML */
  readonly name: string;
  readonly type: "rbac" | "rate_limit" | "audit" | "custom";
  init(ctx: GuardCtx): Promise<void>;
  validate(i: GuardInput): Promise<GuardResult>;  // dry-run
  execute(i: GuardInput): Promise<GuardResult>;   // may mutate state
  cleanup(): Promise<void>;
} 