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