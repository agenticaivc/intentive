# Payroll Natural Language Intent Mapping

## Overview

This document maps natural language user intents to the `payroll-processing` graph execution with specific parameters. It demonstrates how real user requests translate into structured intent graph execution.

## Domain Context

**Payroll System**: Employee compensation processing with approval workflows, tax calculations, and payment execution.

**Key Entities**:
- **Employee**: `{id, name, salary, department, manager_id}`
- **Pay Period**: `{period_id, start_date, end_date, status}` 
- **Payroll Run**: `{run_id, period_id, total_amount, status}`

## Natural Language Mappings

### 1. Standard Payroll Processing

**User Input**: "Process payroll for December 2024"

**Intent Resolution**:
```yaml
graph_id: "payroll-processing"
parameters:
  period: "2024-12"
  run_type: "standard"
user_context:
  id: "finance_user_001"  
  roles: ["finance_manager"]
  permissions: ["payroll:read", "payroll:write"]
```

**Expected Flow**:
1. `authenticate_user` → RBAC guard validates finance_manager role
2. `check_approval_status` → Verify December period approved
3. `fetch_employee_data` → Load active employees for December
4. `calculate_payroll` → Compute gross/net pay, deductions
5. `process_payments` → Execute ACH transfers (rate limited)

---

### 2. Dry Run Processing

**User Input**: "Re-run payroll dry-run for pay period 2024-12"

**Intent Resolution**:
```yaml
graph_id: "payroll-processing"
parameters:
  period: "2024-12"
  run_type: "dry_run"
  dry_run: true
user_context:
  id: "payroll_admin_002"
  roles: ["payroll_admin"] 
  permissions: ["payroll:read", "payroll:write", "payroll:admin"]
```

**Expected Flow**:
- Same execution path but with `dry_run: true` parameter
- `process_payments` node will simulate without actual ACH execution
- Results logged but no financial transactions occur

---

### 3. Emergency Payroll Processing

**User Input**: "Emergency payroll processing for critical employees December 2024"

**Intent Resolution**:
```yaml
graph_id: "payroll-processing"
parameters:
  period: "2024-12"
  run_type: "emergency"
  employee_filter: "critical"
  priority: "high"
user_context:
  id: "hr_director_003"
  roles: ["payroll_admin", "hr_director"]
  permissions: ["payroll:read", "payroll:write", "payroll:emergency"]
```

---

### 4. Quarter-End Processing

**User Input**: "Process Q4 2024 payroll with tax reporting"

**Intent Resolution**:
```yaml
graph_id: "payroll-processing"
parameters:
  period: "2024-Q4"
  quarter_end: true
  include_tax_reporting: true
  run_type: "quarter_end"
user_context:
  id: "finance_director_004"
  roles: ["finance_manager", "tax_admin"]
  permissions: ["payroll:read", "payroll:write", "tax:submit"]
```

## Error Scenarios

### RBAC Failure

**User Input**: "Process payroll for December 2024"

**Intent Resolution** (unauthorized user):
```yaml
graph_id: "payroll-processing"
parameters:
  period: "2024-12"
user_context:
  id: "sales_rep_005"
  roles: ["sales_rep"]  # ❌ Missing required roles
  permissions: ["crm:read"]
```

**Expected Result**: 
- `authenticate_user` node → RBAC guard returns `status: "block"`
- Execution terminates with `execution_failed` event
- Error: "Access denied: User lacks required roles [payroll_admin, finance_manager]"

### Rate Limit Exceeded

**User Input**: "Process payroll for December 2024" (4th attempt within 1 hour)

**Intent Resolution**:
```yaml
graph_id: "payroll-processing"
parameters:
  period: "2024-12"
user_context:
  id: "finance_user_001"
  roles: ["finance_manager"]
  permissions: ["payroll:read", "payroll:write"]
```

**Expected Result**:
- Execution proceeds normally until `process_payments` node
- Rate limit guard returns `status: "delay", retryAfterMs: 1800000` (30 min)
- Node execution delayed until rate limit window resets

## Implementation Notes

### Intent Parser Integration

```typescript
// Example intent parser stub
async function parseIntent(naturalLanguage: string, userContext: UserContext): Promise<IntentGraph> {
  const patterns = [
    {
      pattern: /process payroll for (\w+ \d{4})/i,
      handler: (match) => ({
        graph_id: "payroll-processing",
        parameters: { 
          period: convertToYearMonth(match[1]),
          run_type: "standard"
        }
      })
    },
    {
      pattern: /dry-run.*payroll.*for.*(\d{4}-\d{2})/i,
      handler: (match) => ({
        graph_id: "payroll-processing", 
        parameters: {
          period: match[1],
          run_type: "dry_run",
          dry_run: true
        }
      })
    }
  ];
  
  // Pattern matching logic...
  return resolvedIntent;
}
```

### Parameter Validation

All period parameters should be validated:
- Format: `YYYY-MM` or `YYYY-QX` 
- Range: Current year ±1
- Status: Must be "open" or "approved" for processing

### User Context Requirements

Required fields for all payroll operations:
- `user.id`: Unique identifier for audit trail
- `user.roles`: Must include `payroll_admin` OR `finance_manager`
- `user.permissions`: Must include `["payroll:read", "payroll:write"]` 