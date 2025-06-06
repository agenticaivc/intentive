# Execution Semantics Specification (v0.1)

## Overview

This document defines the **runtime behavior specification** for executing Intentive graphs deterministically and safely. Any language runtime implementing this specification should produce identical execution results given the same graph definition and inputs.

**Scope for v0.1:**
- Single-process execution engine
- Topological ordering with dependency resolution
- Fan-out concurrency with `maxParallel` gate
- Guard/error semantics with conditional edges
- In-memory state management

## Core Concepts

### Execution States

Each node in the graph transitions through the following states:

```
PENDING → READY → RUNNING → COMPLETE
    ↓       ↓        ↓
  SKIPPED  SKIPPED  FAILED → READY (retry)
```

**State Definitions:**
- `PENDING`: Node is waiting for dependencies to complete
- `READY`: All dependencies satisfied, node can be scheduled for execution
- `RUNNING`: Node is currently executing
- `COMPLETE`: Node finished successfully with output
- `FAILED`: Node execution failed with error
- `SKIPPED`: Node bypassed due to failed dependencies or unmet conditions

### Dependency Resolution

Nodes become `READY` when **all** incoming edges' conditions evaluate to `true`:

1. **Source Node Status**: Source node must be in `COMPLETE` state
2. **Edge Conditions**: All conditions on the edge must evaluate to `true`
3. **Guard Results**: All applicable guards must return `success` status

**Condition Evaluation:**
```typescript
// Edge condition example
{
  field: "approval.status",
  operator: "equals", 
  value: "approved"
}

// Evaluates against source node output:
sourceOutput.approval.status === "approved"
```

### Concurrency Model

**Fan-out Execution:**
- Multiple nodes can execute concurrently if dependencies allow
- Concurrency is capped by `spec.config.concurrency.maxParallel`
- Nodes are queued when concurrency limit is reached

**Execution Waves:**
1. Identify all `READY` nodes
2. Start up to `maxParallel` nodes concurrently
3. Wait for any node completion
4. Process newly ready nodes
5. Repeat until all nodes reach terminal states

## Algorithm Specification

### 1. Initialization Phase

```pseudocode
FUNCTION initializeExecution(graph):
    // Validate graph topology
    sortResult = topologicalSort(graph.nodes, graph.edges)
    IF sortResult.cycles.length > 0:
        THROW "Graph contains cycles: " + sortResult.cycles
    
    // Load configuration
    config = loadConfiguration(graph.spec.config)
    
    // Initialize state
    executionState = new ExecutionState()
    FOR EACH node IN graph.nodes:
        executionState.initializeNode(node.id)
    
    // Initialize concurrency manager
    concurrencyManager = new ConcurrencyManager(config.concurrency.maxParallel)
    
    RETURN ExecutionContext{
        graph: graph,
        config: config,
        state: executionState,
        concurrency: concurrencyManager,
        lifecycle: new NodeLifecycle(executionState)
    }
```

### 2. Execution Phase

```pseudocode
FUNCTION executeGraph(context):
    WHILE NOT context.state.isExecutionComplete():
        // Find nodes ready for execution
        readyNodes = context.lifecycle.getReadyNodes(context.graph.edges, context.graph.nodes)
        
        // Start nodes within concurrency limits
        FOR EACH nodeId IN readyNodes:
            IF context.concurrency.hasCapacity():
                promise = startNodeExecution(nodeId, context)
                context.concurrency.addRunningNode(nodeId, promise)
            ELSE:
                context.concurrency.addToWaitingQueue(nodeId)
        
        // Wait for any completion if nodes are running
        IF context.concurrency.getCurrentLoad() > 0:
            completedNodeId = AWAIT context.concurrency.waitForAnyCompletion()
            
            // Process waiting queue
            nextNodes = context.concurrency.getNextFromQueue()
            FOR EACH nodeId IN nextNodes:
                promise = startNodeExecution(nodeId, context)
                context.concurrency.addRunningNode(nodeId, promise)
    
    RETURN generateExecutionResult(context)
```

### 3. Node Execution

```pseudocode
FUNCTION startNodeExecution(nodeId, context):
    RETURN ASYNC FUNCTION():
        TRY:
            // Transition to running
            context.lifecycle.transitionNode(nodeId, "RUNNING")
            
            // Execute node handler
            node = findNode(nodeId, context.graph.nodes)
            output = AWAIT executeNodeHandler(node, context)
            
            // Store output and mark complete
            context.state.setNodeOutput(nodeId, output)
            context.lifecycle.transitionNode(nodeId, "COMPLETE")
            
        CATCH error:
            // Mark as failed and skip downstream
            context.lifecycle.transitionNode(nodeId, "FAILED", error)
            context.lifecycle.markDownstreamAsSkipped(nodeId, context.graph.edges)
            
            // Emit execution_failed event
            emitEvent("execution_failed", {
                nodeId: nodeId,
                error: error,
                timestamp: now()
            })
```

### 4. Guard Processing

```pseudocode
FUNCTION evaluateGuards(nodeId, context):
    applicableGuards = findApplicableGuards(nodeId, context.graph.guards)
    
    FOR EACH guard IN applicableGuards:
        result = AWAIT guard.validate(createGuardInput(nodeId, context))
        
        SWITCH result.status:
            CASE "success":
                CONTINUE
            CASE "block":
                context.lifecycle.transitionNode(nodeId, "SKIPPED")
                RETURN false
            CASE "delay":
                scheduleRetry(nodeId, result.retryAfterMs, context)
                RETURN false
            CASE "warn":
                logWarning(result.message)
                CONTINUE
    
    RETURN true
```

## Error Propagation

### Failure Handling

When a node fails (`FAILED` state):

1. **Immediate Actions:**
   - Mark node as `FAILED` with error details
   - Emit `execution_failed` event
   - Stop graph execution (v0.1 behavior)

2. **Downstream Impact:**
   - All downstream nodes are marked as `SKIPPED`
   - Transitive dependencies are also skipped
   - No further execution occurs

3. **Error Information:**
   ```typescript
   {
     nodeId: string,
     error: Error,
     timestamp: Date,
     retryCount: number
   }
   ```

### Guard Blocking

When a guard returns `block` status:

1. **Node Handling:**
   - Mark node as `SKIPPED`
   - Do not execute node handler
   - Continue with other ready nodes

2. **Downstream Impact:**
   - Downstream nodes evaluate their own dependencies
   - May become ready if other paths exist
   - Only blocked if this was the only dependency path

## State Management

### In-Memory Store

The execution state maintains:

```typescript
interface ExecutionState {
  nodeStates: Map<string, NodeExecutionState>
  nodeOutputs: Map<string, unknown>
  globalContext: Map<string, unknown>
}

interface NodeExecutionState {
  nodeId: string
  status: NodeExecutionStatus
  startTime?: Date
  endTime?: Date
  output?: unknown
  error?: Error
  retryCount: number
}
```

### State Transitions

Valid state transitions:

```
PENDING → [READY, SKIPPED]
READY → [RUNNING, SKIPPED]  
RUNNING → [COMPLETE, FAILED]
COMPLETE → [] (terminal)
FAILED → [READY] (retry only)
SKIPPED → [] (terminal)
```

**Transition Rules:**
- Transitions must follow the valid paths above
- Terminal states (`COMPLETE`, `SKIPPED`) cannot transition
- `FAILED` nodes can only transition to `READY` for retries
- All transitions are atomic and logged

## Lifecycle Events

### Event Types

```typescript
type ExecutionEvent = 
  | "execution_started"
  | "node_ready" 
  | "node_running"
  | "node_complete"
  | "node_failed"
  | "node_skipped"
  | "execution_complete"
  | "execution_failed"
```

### Event Timing

```
execution_started
    ↓
node_ready → node_running → node_complete
    ↓            ↓              ↓
node_skipped  node_failed  execution_complete
                ↓
            execution_failed
```

## Configuration

### Required Settings

```yaml
config:
  concurrency:
    maxParallel: 5        # 1-100, required
  timeout: 300            # 1-3600 seconds, optional
  retry:                  # optional
    maxAttempts: 3        # 1-10, optional
    backoffMultiplier: 2  # 1-10, optional
```

### Validation Rules

- `maxParallel`: Must be between 1 and 100
- `timeout`: Must be between 1 and 3600 seconds
- `maxAttempts`: Must be between 1 and 10
- `backoffMultiplier`: Must be between 1 and 10

## Implementation Requirements

### Thread Safety

- All state mutations must be atomic
- Concurrent access to execution state must be synchronized
- Node output storage must be thread-safe

### Memory Management

- Node outputs should be stored until execution completes
- Failed node errors must be preserved for debugging
- Global context should be cleared after execution

### Logging

Minimum required log events:
```
INFO: Execution started - graph: {graphId}, nodes: {count}
INFO: Node ready - {nodeId}
INFO: Node running - {nodeId} 
INFO: Node complete - {nodeId}, duration: {ms}
ERROR: Node failed - {nodeId}, error: {message}
INFO: Execution complete - duration: {ms}, success: {count}, failed: {count}
```

## Reference Implementation

The TypeScript reference implementation provides:

- `TopologicalSorter`: Dependency ordering with cycle detection
- `ExecutionState`: Thread-safe state management
- `NodeLifecycle`: State transitions and dependency checking
- `ConcurrencyManager`: Parallel execution with limits
- `ConfigLoader`: Configuration validation and loading

**Usage Example:**
```typescript
import { TopologicalSorter, ExecutionState, NodeLifecycle, 
         ConcurrencyManager, ConfigLoader } from '@intentive/executor';

// Initialize components
const config = ConfigLoader.loadCompleteConfig(graph.spec.config);
const sorter = new TopologicalSorter();
const state = new ExecutionState();
const lifecycle = new NodeLifecycle(state);
const concurrency = new ConcurrencyManager(config.concurrency.maxParallel);

// Validate topology
const sortResult = sorter.sort(graph.spec.nodes, graph.spec.edges);
if (!sortResult.hasValidTopology) {
  throw new Error(`Graph contains cycles: ${sortResult.cycles}`);
}

// Execute graph
await executeGraph({ graph, config, state, lifecycle, concurrency });
```

## Compliance Testing

Implementations must pass the following test scenarios:

1. **Dependency Order**: Nodes execute in topologically correct order
2. **Concurrency Limits**: Never exceed `maxParallel` concurrent executions
3. **Error Propagation**: Failed nodes skip all downstream dependencies
4. **Conditional Edges**: Edge conditions properly gate node execution
5. **State Consistency**: All state transitions follow valid paths
6. **Guard Integration**: Guard results properly control execution flow

## Future Extensions (Post-v0.1)

- **Retry Logic**: Automatic retry with exponential backoff
- **Event System**: Pluggable event handlers and notifications
- **Distributed Execution**: Multi-process/multi-node execution
- **Persistent State**: Database-backed state management
- **Dynamic Graphs**: Runtime graph modification
- **Performance Metrics**: Detailed execution analytics

---

**Version**: v0.1  
**Status**: Implementation Complete  
**Last Updated**: 2025-01-15 