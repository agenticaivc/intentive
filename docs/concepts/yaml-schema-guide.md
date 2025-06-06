# Intent Graph YAML Schema Usage Guide

## Overview

This guide explains how to use the Intent Graph YAML schema to define workflow automation for the Intentive platform. The schema follows Kubernetes CRD patterns for familiarity and validation.

## Reserved Keywords Table

The following keywords are reserved and have special meaning in Intent Graph definitions. Using these as custom field names may cause conflicts with future schema extensions.

| Category            | Reserved Keywords                                                                                                          | Description                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Top Level**       | `apiVersion`, `kind`, `metadata`, `spec`                                                                                   | Core Kubernetes-style structure                               |
| **Metadata**        | `name`, `description`, `version`, `author`, `created`, `tags`                                                              | Graph identification fields                                   |
| **Node Fields**     | `node.id`, `node.type`, `node.properties`, `node.metadata`                                                                 | Node structure                                                |
| **Node IDs**        | `node.id`                                                                                                                  | Unique node identifiers (must be unique across entire graph)  |
| **Node Types**      | `action`, `decision`, `data`                                                                                               | Valid node type values                                        |
| **Node Properties** | `name`, `description`, `handler`, `parameters`, `conditions`, `output`                                                     | Node configuration                                            |
| **Edge Fields**     | `edge.id`, `edge.from`, `edge.to`, `edge.type`, `edge.properties`, `edge.conditions`, `edge.data_mapping`, `edge.metadata` | Edge structure                                                |
| **Edge IDs**        | `edge.id`                                                                                                                  | Unique edge identifiers (must be unique across entire graph)  |
| **Edge Types**      | `sequence`, `conditional`                                                                                                  | Valid edge type values (v0.1)                                 |
| **Guard Fields**    | `guard.name`, `guard.type`, `guard.apply_to`, `guard.config`, `guard.metadata`                                             | Guard structure                                               |
| **Guard Names**     | `guard.name`                                                                                                               | Unique guard identifiers (must be unique across entire graph) |
| **Guard Types**     | `rbac`, `rate_limit`, `audit`, `custom`, `temporal`                                                                        | Valid guard type values                                       |
| **Guard Apply**     | `apply_to.nodes`, `apply_to.edges`                                                                                         | Guard application targets                                     |
| **Config Fields**   | `timeout`, `retry`, `concurrency`                                                                                          | Execution configuration                                       |
| **Parameter Types** | `string`, `number`, `boolean`, `array`, `object`                                                                           | Parameter data types                                          |
| **Operators**       | `equals`, `not_equals`, `greater_than`, `less_than`, `in`, `contains`, `within_hours`                                      | Condition operators                                           |
| **Logic**           | `AND`, `OR`, `NOT`                                                                                                         | Boolean logic operators                                       |
| **Priorities**      | `low`, `medium`, `high`, `critical`                                                                                        | Priority levels                                               |

## Basic Usage

### Minimal Example

The simplest possible intent graph demonstrates the core schema structure:

```yaml
# Minimal Intent Graph Example
# Demonstrates basic schema structure with single node workflow

apiVersion: intentive.dev/v1
kind: IntentGraph
metadata:
  name: minimal-example
  description: "Simplest possible intent graph for getting started"
  version: "1.0.0"
  author: "intentive-docs"
  created: "2025-01-15T10:00:00Z"

spec:
  nodes:
    - id: "hello_world"
      type: "action"
      properties:
        name: "Hello World Action"
        description: "Basic action node for demonstration"
        handler: "system.log_message"
        parameters:
          - name: "message"
            type: "string"
            required: true
            description: "Message to log"
            default: "Hello, Intent Graph!"
          - name: "log_level"
            type: "string"
            required: false
            description: "Logging level"
            default: "info"
        output:
          type: "object"
          properties:
            timestamp:
              type: "string"
            success:
              type: "boolean"
      metadata:
        tags: ["demo", "simple"]
        estimated_duration: "1s"
        priority: "low"

  config:
    timeout: 60
    retry:
      maxAttempts: 1
      backoffMultiplier: 1
    concurrency:
      maxParallel: 1
```

This example is available as `docs/examples/minimal-workflow.yaml` and demonstrates:

- Required top-level fields (`apiVersion`, `kind`, `metadata`, `spec`)
- Single action node with complete parameter definitions
- Output specification with object properties
- Node metadata including tags and priority
- Basic configuration settings

### Complete Example Structure

```yaml
apiVersion: intentive.dev/v1
kind: IntentGraph
metadata:
  name: example-graph
  description: "Example workflow"
  version: "1.0.0"
spec:
  nodes:
    - id: "node_id"
      type: "action|decision|data"
      properties:
        name: "Human Readable Name"
        description: "What this node does"
        handler: "module.function"
        parameters: []
      metadata:
        tags: ["tag1", "tag2"]
        estimated_duration: "5s"
        priority: "medium"

  edges:
    - id: "edge_id"
      from: "source_node_id"
      to: "target_node_id"
      type: "sequence|conditional"
      conditions: []

  guards:
    - name: "guard_name"
      type: "rbac|rate_limit|audit|custom|temporal"
      apply_to:
        nodes: ["node_id"]
        edges: ["edge_id"]
      config: {}

  config:
    timeout: 300
    retry:
      maxAttempts: 3
    concurrency:
      maxParallel: 5
```

## Node Types

### Action Nodes

Execute specific operations or call external services.

```yaml
- id: "send_email"
  type: "action"
  properties:
    name: "Send Notification Email"
    handler: "email.send"
    parameters:
      - name: "recipient"
        type: "string"
        required: true
      - name: "subject"
        type: "string"
        required: true
      - name: "body"
        type: "string"
        required: true
```

### Decision Nodes

Implement conditional logic and branching.

```yaml
- id: "check_status"
  type: "decision"
  properties:
    name: "Check Approval Status"
    handler: "approval.check"
    conditions:
      - field: "status"
        operator: "equals"
        value: "approved"
        output: "approved"
      - field: "status"
        operator: "equals"
        value: "rejected"
        output: "rejected"
```

### Data Nodes

Transform, calculate, or aggregate data.

```yaml
- id: "calculate_total"
  type: "data"
  properties:
    name: "Calculate Total Amount"
    handler: "math.sum"
    parameters:
      - name: "values"
        type: "array"
        required: true
    output:
      type: "number"
```

## Edge Types (v0.1)

### Sequential Edges

Execute nodes in order.

```yaml
- id: "step1_to_step2"
  from: "step1"
  to: "step2"
  type: "sequence"
```

### Conditional Edges

Execute based on conditions.

```yaml
- id: "conditional_flow"
  from: "decision_node"
  to: "action_node"
  type: "conditional"
  conditions:
    - field: "result"
      operator: "equals"
      value: "success"
```

## Parameter Validation

### String Parameters

```yaml
- name: "email"
  type: "string"
  required: true
  pattern: "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$"
  description: "Valid email address"
```

### Number Parameters

```yaml
- name: "amount"
  type: "number"
  required: true
  minimum: 0
  maximum: 1000000
  description: "Payment amount in dollars"
```

### Object Parameters

```yaml
- name: "user_profile"
  type: "object"
  required: true
  properties:
    name:
      type: "string"
      required: true
    age:
      type: "number"
      required: false
      minimum: 0
      maximum: 150
```

## Guard Configuration

### RBAC Guards

```yaml
- name: "admin_only"
  type: "rbac"
  apply_to:
    nodes: ["sensitive_operation"]
  config:
    required_roles: ["admin"]
    required_permissions: ["resource:write"]
    check_mode: "strict"
    failure_action: "block"
```

### Rate Limiting Guards

```yaml
- name: "api_rate_limit"
  type: "rate_limit"
  apply_to:
    nodes: ["api_call"]
  config:
    max_requests: 10
    time_window: "1m"
    failure_action: "delay"
```

### Audit Guards

```yaml
- name: "security_audit"
  type: "audit"
  apply_to:
    nodes: ["security_operation"]
  config:
    log_level: "info"
    include_parameters: true
    retention_days: 365
```

## Best Practices

### Naming Conventions

- Use lowercase with underscores for IDs: `process_payment`
- Use descriptive names for readability: `"Process Monthly Payroll"`
- Keep handler names consistent: `module.function`

### Error Handling

- Always include error paths in conditional edges
- Use appropriate failure actions in guards
- Set reasonable timeout values

### Documentation

- Include meaningful descriptions for all nodes and edges
- Use tags for categorization and searching
- Document parameter requirements clearly

### Validation

- Use the JSON Schema for validation during development
- Test with the provided payroll example
- Validate reserved keyword usage

## Common Patterns

### Linear Workflow

```yaml
edges:
  - from: "step1"
    to: "step2"
    type: "sequence"
  - from: "step2"
    to: "step3"
    type: "sequence"
```

### Conditional Branching

```yaml
edges:
  - from: "decision"
    to: "success_path"
    type: "conditional"
    conditions:
      - field: "result"
        operator: "equals"
        value: "success"
  - from: "decision"
    to: "error_path"
    type: "conditional"
    conditions:
      - field: "result"
        operator: "equals"
        value: "error"
```

### Error Recovery

```yaml
edges:
  - from: "error_handler"
    to: "retry_operation"
    type: "conditional"
    conditions:
      - field: "retry_count"
        operator: "less_than"
        value: 3
```

## Validation

Use the provided JSON Schema for validation:

```bash
# Validate YAML file against JSON Schema
npm install -g ajv-cli
ajv validate -s docs/schemas/intent-graph-schema.json -d your-workflow.yaml
```

## Future Enhancements (Post-v0.1)

The following features are planned for future versions:

- `parallel` and `loop` edge types
- Guard execution order and dependencies
- Schema migration and versioning
- Gateway node types for external integrations
- Advanced condition expressions and variables

## Support

For questions about the schema or reporting issues:

- Reference the comprehensive payroll example in `docs/examples/`
- Check reserved keywords table for naming conflicts
- Validate against the JSON Schema before deployment
