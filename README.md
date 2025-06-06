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

## 📜 Documentation
* **Getting Started** – [intentive.dev/docs](https://intentive.dev/docs)
* **Schema guide** – `docs/concepts/yaml-schema-guide.md`  
* **Guard ABI** – `docs/concepts/guard-abi.md`  
* **Architecture** – _placeholder (`docs/architecture.md`)_

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
