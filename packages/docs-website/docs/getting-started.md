---
sidebar_position: 1
---

# Getting Started

Get Intentive running in **under 15 minutes** ⏱️

## 🚀 Shell-Agnostic Quick Setup

### One-Line Install & Demo
```bash
curl -fsSL https://get.pnpm.io/install.sh | sh - && pnpm i && pnpm payroll:demo
```

**Windows PowerShell:**
```powershell
irm https://get.pnpm.io/install.ps1 | iex; pnpm i; pnpm payroll:demo
```

### Manual Setup (3 Steps)

**Prerequisites:**
- Node.js 18+ ([Download](https://nodejs.org/))
- Git ([Download](https://git-scm.com/))

```bash
# 1. Clone and install
git clone https://github.com/agenticaivc/intentive.git
cd intentive
pnpm install

# 2. Run the payroll demo  
pnpm payroll:demo

# 3. Check execution status (NEW!)
curl http://localhost:4000/intent/{execution-id}

# 4. List all executions (NEW!)
curl http://localhost:4000/intent
```

**Expected Output:**
```
🚀 Starting Intentive Payroll Demo...
✅ Loaded graph: payroll-demo (5 nodes)
✅ Context ready for user: demo_user
⚡ Executing payroll workflow...
🎉 Payroll success! Demo completed successfully
📊 Results: 5 nodes executed, 0 errors
⏱️  Execution time: 304ms
```

## 📊 Step 4: List All Executions

View and filter your execution history:

```bash
# List recent executions (default: 20 items)
curl http://localhost:4000/intent

# Filter by status
curl "http://localhost:4000/intent?status=completed"

# Multiple status filter
curl "http://localhost:4000/intent?status=completed,failed"

# Pagination (limit results)
curl "http://localhost:4000/intent?limit=5"

# Cursor-based pagination
curl "http://localhost:4000/intent?limit=5&cursor={executionId}"
```

**List Response:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "graph": "payroll",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "status": "completed",
      "durationMs": 304,
      "user": { "id": "anonymous" }
    }
  ],
  "nextCursor": "550e8400-e29b-41d4-a716-446655440001"
}
```

**Query Parameters:**
- `status` - Filter by execution status (queued, running, completed, failed)
- `limit` - Maximum items per page (1-100, default: 20)
- `cursor` - Execution ID for pagination
- `user` - Filter by user ID (admin only)

## 🎮 Interactive Playground

<a href="https://codesandbox.io/s/intentive-payroll-demo-tsx" target="_blank">
  <img src="https://codesandbox.io/static/img/play-codesandbox.svg" alt="Open in CodeSandbox" />
</a>

## 🔍 What Just Happened?

1. **Real Execution** - Called the actual `Executor` class from `packages/executor`
2. **YAML Parsing** - Loaded a simplified payroll graph with 5 nodes
3. **Security Checks** - Validated user permissions and roles
4. **Workflow Orchestration** - Executed nodes in topologically sorted order

## 🔥 Next Steps

- [Schema Guide](./schema-guide) - Master the YAML format
- [Custom Graphs](./custom-graphs) - Build your own workflows  
- [API Reference](./api) - Integrate with your systems
- [Troubleshooting](./troubleshooting) - Common issues & solutions 