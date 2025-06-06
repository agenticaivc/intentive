# Intentive

> **🚀 From idea to execution in 15 minutes**  
> Natural-language → intent graph → guarded execution with built-in RBAC, rate limits, and audit trails.

[![Documentation](https://img.shields.io/website.svg?url=https://intentive.dev/docs/getting-started&label=docs)](https://intentive.dev/docs)
[![Tests](https://github.com/agenticaivc/intentive/workflows/CI/badge.svg)](https://github.com/agenticaivc/intentive/actions)

## ⚡ Try It Now (Any Shell)

**Bash/Zsh:**
```bash
curl -fsSL https://get.pnpm.io/install.sh | sh - && git clone https://github.com/agenticaivc/intentive.git && cd intentive && pnpm i && pnpm payroll:demo
```

**PowerShell:**
```powershell
irm https://get.pnpm.io/install.ps1 | iex; git clone https://github.com/agenticaivc/intentive.git; cd intentive; pnpm i; pnpm payroll:demo
```

Expected: **"🎉 Payroll success!"** in ~15 seconds

[📖 Full Getting Started Guide →](https://intentive.dev/docs/)

---

## ✨ What's inside v0.1
| Component | Path | Status |
|-----------|------|--------|
| **Intent Graph YAML schema** | `docs/schemas/intent-graph-schema.{yaml,json}` | ✅ |
| **Guard ABI** | `packages/guards/src/GuardABI.ts` | ✅ |
| **Reference gateway** | `packages/gateway/` | ✅ |
| **Examples** | `docs/examples/` | ✅ minimal & [payroll](docs/examples/payroll-graph.yaml) |

---

## 🏃 Quick start

```bash
# 1. Clone & install
git clone https://github.com/agenticaivc/intentive.git
cd intentive && pnpm ci

# 2. Run schema tests
npm run schema:test      # validates YAML examples

# 3. Try the payroll example
pnpm payroll:demo  # executes real workflow

# 4. Start the gateway
npm run gateway:dev
# Open http://localhost:4000/health ➜ {"status":"ok"}
```

Test the intent endpoint:

```bash
curl -X POST http://localhost:4000/intent \
  -H "Content-Type: application/json" \
  -d '{"ask":"Process payroll for 2025-05"}'
# Returns: {"executionId":"uuid-v4-here"}
```

---

## 🧪 **Step-by-Step API Testing Guide**

**Human-friendly walkthrough** - exactly what you'd do to test the API:

## ⚡ **Quick Test (30 seconds)**
```bash
# 1. Create an intent
curl -X POST http://localhost:4000/intent -H "Content-Type: application/json" -d '{"ask":"Test payroll"}'

# 2. List all executions  
curl http://localhost:4000/intent

# 3. Filter by status
curl "http://localhost:4000/intent?status=queued"
```
**Expected:** JSON responses showing intent creation → listing → filtering ✅

---

### **Step 1: Check if the server is running**
```bash
curl http://localhost:4000/__health
```
**Expected:** `{"status":"ok"}`  
**Showcases:** Gateway is up and responding

---

### **Step 2: Create your first intent execution**
```bash
curl -X POST http://localhost:4000/intent \
  -H "Content-Type: application/json" \
  -d '{"ask":"Process December payroll"}'
```
**Expected:** `{"executionId":"550e8400-e29b-41d4-a716-446655440000"}`  
**Showcases:** Natural language → structured execution

---

### **Step 3: Check the execution status**
```bash
# Use the executionId from Step 2
curl http://localhost:4000/intent/550e8400-e29b-41d4-a716-446655440000
```
**Expected:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "graph": "payroll",
  "status": "completed",
  "durationMs": 150,
  "user": {"id": "anonymous"}
}
```
**Showcases:** Real-time execution tracking with performance metrics

---

### **Step 4: List all your executions**
```bash
curl http://localhost:4000/intent
```
**Expected:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "graph": "payroll",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "status": "completed",
      "durationMs": 150,
      "user": {"id": "anonymous"}
    }
  ]
}
```
**Showcases:** Complete execution history (most recent first)

---

### **Step 5: Create multiple intents to see filtering**
```bash
# Create a few more for testing
curl -X POST http://localhost:4000/intent -H "Content-Type: application/json" -d '{"ask":"Generate financial report"}'
curl -X POST http://localhost:4000/intent -H "Content-Type: application/json" -d '{"ask":"Run compliance audit"}'
curl -X POST http://localhost:4000/intent -H "Content-Type: application/json" -d '{"ask":"Process employee benefits"}'
```
**Expected:** 3 more executionIds  
**Showcases:** Rapid intent processing

---

### **Step 6: Filter by status**
```bash
# See only queued executions
curl "http://localhost:4000/intent?status=queued"
```
**Expected:** Only executions with `"status": "queued"`  
**Showcases:** Smart filtering for workflow management

---

### **Step 7: Try multiple status filters**
```bash
# See completed AND failed executions
curl "http://localhost:4000/intent?status=completed,failed"
```
**Expected:** Mix of completed and failed executions  
**Showcases:** Flexible multi-criteria filtering

---

### **Step 8: Test pagination**
```bash
# Get only 2 results
curl "http://localhost:4000/intent?limit=2"
```
**Expected:**
```json
{
  "items": [...2 items...],
  "nextCursor": "def-456-ghi-789"
}
```
**Showcases:** Cursor-based pagination for large datasets

---

### **Step 9: Use the cursor for next page**
```bash
# Use the nextCursor from Step 8
curl "http://localhost:4000/intent?limit=2&cursor=def-456-ghi-789"
```
**Expected:** Next 2 executions (different from previous page)  
**Showcases:** Seamless pagination navigation

---

### **Step 10: Browser testing (optional)**
Open in your browser:
- **Health check:** http://localhost:4000/__health
- **List executions:** http://localhost:4000/intent
- **Filtered view:** http://localhost:4000/intent?status=completed&limit=1

**Showcases:** RESTful API works in browsers too

---

## 🎯 **What This Demonstrates**

| Feature | API Call | Business Value |
|---------|----------|----------------|
| **Natural Language Processing** | `POST /intent` | Non-technical users can create workflows |
| **Real-time Tracking** | `GET /intent/:id` | Monitor execution progress & performance |
| **Workflow Management** | `GET /intent?status=queued` | Focus on active/pending tasks |
| **Audit & History** | `GET /intent` | Complete execution trail for compliance |
| **Scalable Pagination** | `GET /intent?limit=10&cursor=...` | Handle thousands of executions efficiently |
| **15-Minute Guarantee** | All endpoints < 100ms | Enterprise-grade performance SLA |

---

**🎬 One-Click Demo Script:**
```bash
# Make executable and run comprehensive test
chmod +x scripts/test-api.sh && ./scripts/test-api.sh
```

## 🔧 **Troubleshooting**

**Gateway not starting?**
```bash
# Check if port 4000 is already in use
lsof -i :4000
# Kill any existing process and restart
npm run gateway:dev
```

**API calls failing?**
```bash
# Verify gateway is running
curl http://localhost:4000/__health
# Should return: {"status":"ok"}
```

**Can't find executionId?**
```bash
# List recent executions to get valid IDs
curl http://localhost:4000/intent?limit=5
```

**Empty list results?**
```bash
# Create a test execution first
curl -X POST http://localhost:4000/intent -H "Content-Type: application/json" -d '{"ask":"Test"}'
```

---

## 📜 Documentation
* **Getting Started** – [intentive.dev/docs](https://intentive.dev/docs)
* **Schema guide** – `docs/concepts/yaml-schema-guide.md`  
* **Guard ABI** – `docs/concepts/guard-abi.md`  
* **Architecture** – _placeholder (`docs/architecture.md`)_

## 🎯 Quick Start with Specs:
Understand the concept: Read docs/concepts/execution-semantics.md
Learn the schema: Review docs/schemas/intent-graph-schema.yaml
See it in action: Check docs/examples/payroll-graph.yaml
Build your own: Follow docs/concepts/yaml-schema-guide.md

---

## 🛣️ Road-map
| Milestone | Target | Issue labels |
|-----------|--------|--------------|
| **v0.1** – spec + TCK + guard ABI | 2025-07 | `v0.1` |
| **v0.2** – playground UI, Rust SDK | 2025-Q3 | `v0.2` |
| **v1.0** – CNCF sandbox application | 2026-Q1 | `v1.0` |

---

## 🤝 Contributing
We love first PRs!  Check the [good first issue](https://github.com/<org>/intentive/labels/good%20first%20issue) list and see `CONTRIBUTING.md`.

---

## ⚖️ License
Apache-2.0 © 2025 Intentive Contributors

> _Commercial guard packs and the hosted control-plane are licensed separately.  See `/LICENSE`._
