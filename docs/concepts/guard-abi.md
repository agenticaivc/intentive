# Guard ABI (Application Binary Interface) - v0.1

## Overview

The Guard ABI defines the contract that all security guards must implement to integrate with the Intentive execution engine. This ensures zero bespoke glue code for loading and executing guards.

## Interface Contract

All guards must implement the `Guard` interface:

```typescript
export interface Guard {
  readonly name: string;
  readonly type: "rbac" | "rate_limit" | "audit" | "custom";
  
  init(ctx: GuardCtx): Promise<void>;
  validate(i: GuardInput): Promise<GuardResult>;  // dry-run
  execute(i: GuardInput): Promise<GuardResult>;   // may mutate state
  cleanup(): Promise<void>;
}
```

## Lifecycle Sequence

```
1. init() - Called once when guard is loaded
2. validate() - Dry-run check (may be called multiple times)
3. execute() - Actual execution with side effects
4. cleanup() - Called when workflow completes
```

## Guard Types (v0.1 Scope)

### RBAC Guard
- **Purpose**: Role-based access control
- **Config**: `requiredRoles`, `requiredPermissions`, `allowSuperuser`
- **Behavior**: Blocks execution if user lacks required roles/permissions

**Example Configuration:**
```yaml
guards:
  - name: admin_only
    type: rbac
    config:
      type: rbac
      requiredRoles: ["admin", "superuser"]
      allowSuperuser: true
    apply_to:
      nodes: ["sensitive_action"]
```

**Example Implementation:**
```typescript
// Check superuser bypass
if (this.config.allowSuperuser && user.roles.includes('superuser')) {
  return { status: 'success', message: 'Superuser access granted' };
}

// Check required roles
const hasRequiredRole = this.config.requiredRoles.some(role => 
  user.roles.includes(role)
);

if (!hasRequiredRole) {
  return {
    status: 'block',
    message: `Access denied: requires one of roles [${this.config.requiredRoles.join(', ')}]`
  };
}
```

### Rate Limit Guard
- **Purpose**: Throttle execution frequency
- **Config**: `maxRequests`, `windowMs`, `keyGenerator`
- **Behavior**: Returns `delay` status with `retryAfterMs` when limit exceeded

**Example Configuration:**
```yaml
guards:
  - name: api_rate_limit
    type: rate_limit
    config:
      type: rate_limit
      maxRequests: 100
      windowMs: 60000  # 1 minute
      keyGenerator: user
    apply_to:
      edges: ["api_call_edge"]
```

## Input/Output Types

### GuardInput
```typescript
interface GuardInput {
  correlationId: string;
  user: { id: string; roles: string[]; permissions: string[] };
  nodeOrEdgeId: string;
  parameters: Record<string, unknown>;
  priorResults: Record<string, unknown>;
}
```

### GuardResult
```typescript
interface GuardResult {
  status: "success" | "block" | "delay" | "warn";
  message?: string;
  retryAfterMs?: number;  // only for "delay"
  meta?: Record<string, unknown>;
}
```

## Error Handling

Guards should throw `GuardError` subclasses:

```typescript
export class GuardError extends Error
export class GuardConfigError extends GuardError
export class GuardRuntimeError extends GuardError
```

## Configuration Schema

All guard configurations are validated against `/docs/schemas/guard-config-schema.json`. Unknown fields will fail validation.

### RBAC Config Schema
```json
{
  "type": "rbac",
  "requiredRoles": ["admin"],           // required
  "requiredPermissions": ["write"],     // optional
  "allowSuperuser": true                // optional, default: false
}
```

### Rate Limit Config Schema
```json
{
  "type": "rate_limit",
  "maxRequests": 100,                   // required, 1-10000
  "windowMs": 60000,                    // required, 1s-24h
  "keyGenerator": "user"                // optional, default: "user"
}
```

## Example Implementations

See `/examples/guards/` for complete reference implementations:
- `noop-guard.ts` - Always returns success (used in tests)
- `rbac-guard.ts` - Role-based access control implementation

## Sequence Diagram

```
User Request → Engine → Guard.validate() → Guard.execute() → Continue/Block
                  ↓
              Guard.cleanup() (on workflow completion)
```

---

**Note**: This is v0.1 scope. Audit and temporal guards will be added in post-v0.1 releases. 