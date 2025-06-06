// Core types for Intentive graph execution
// Based on interface verification from docs/schemas/intent-graph-schema.yaml

export type NodeType = "action" | "decision" | "data";
export type EdgeType = "sequence" | "conditional";
export type GuardType = "rbac" | "rate_limit" | "audit" | "custom" | "temporal";
export type ParameterType = "string" | "number" | "boolean" | "array" | "object";
export type ConditionOperator = "equals" | "not_equals" | "greater_than" | "less_than" | "in" | "contains" | "within_hours";
export type LogicOperator = "AND" | "OR" | "NOT";
export type Priority = "low" | "medium" | "high" | "critical";

// Node execution states
export type NodeExecutionStatus = "PENDING" | "READY" | "RUNNING" | "COMPLETE" | "FAILED" | "SKIPPED";

// Graph structure interfaces
export interface IntentNode {
  id: string;
  type: NodeType;
  properties: NodeProperties;
  metadata?: NodeMetadata;
}

export interface NodeProperties {
  name: string;
  description?: string;
  handler: string;
  parameters?: Parameter[];
  conditions?: Condition[];
  output?: OutputSpec;
}

export interface Parameter {
  name: string;
  type: ParameterType;
  required: boolean;
  description?: string;
  default?: unknown;
  pattern?: string;
  example?: string;
}

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
  output?: string;
}

export interface OutputSpec {
  type: ParameterType;
  properties?: Record<string, TypeSpec>;
  items?: TypeSpec;
}

export interface TypeSpec {
  type: ParameterType;
  required?: boolean;
  minimum?: number;
  maximum?: number;
}

export interface NodeMetadata {
  tags?: string[];
  estimated_duration?: string;
  priority?: Priority;
}

export interface IntentEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  properties?: EdgeProperties;
  conditions?: Condition[];
  data_mapping?: DataMapping[];
  metadata?: Record<string, unknown>;
}

export interface EdgeProperties {
  name?: string;
  description?: string;
}

export interface DataMapping {
  source: string;
  target: string;
}

export interface IntentGuard {
  name: string;
  type: GuardType;
  description?: string;
  apply_to: GuardApplyTo;
  config: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface GuardApplyTo {
  nodes?: string[];
  edges?: string[];
}

export interface ExecutionConfig {
  timeout?: number;
  retry?: RetryConfig;
  concurrency?: ConcurrencyConfig;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  retry_on_errors?: string[];
  no_retry_errors?: string[];
}

export interface ConcurrencyConfig {
  maxParallel: number;
}

export interface IntentGraph {
  apiVersion: string;
  kind: string;
  metadata: GraphMetadata;
  spec: GraphSpec;
}

export interface GraphMetadata {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  created?: string;
  tags?: string[];
}

export interface GraphSpec {
  nodes: IntentNode[];
  edges: IntentEdge[];
  guards: IntentGuard[];
  config: ExecutionConfig;
}

// Execution runtime types
export interface NodeExecutionState {
  nodeId: string;
  status: NodeExecutionStatus;
  startTime?: Date;
  endTime?: Date;
  output?: unknown;
  error?: Error;
  retryCount: number;
}

export interface ExecutionContext {
  graphId: string;
  executionId: string;
  correlationId: string;
  user: {
    id: string;
    roles: string[];
    permissions: string[];
  };
  config: ExecutionConfig;
  logger?: typeof console;
}

export interface ExecutionResult {
  success: boolean;
  completedNodes: string[];
  failedNodes: string[];
  skippedNodes: string[];
  executionTime: number;
  error?: Error;
} 