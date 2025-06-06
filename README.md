# Intentive

> **Natural-language → intent graph → guarded execution.**  
> Ask for the outcome you want; Intentive maps it to secure GraphQL / workflow calls with built-in RBAC, rate limits, and audit trails.

---

## ✨ What's inside v0.1
| Component | Path | Status |
|-----------|------|--------|
| **Intent Graph YAML schema** | `docs/schemas/intent-graph-schema.{yaml,json}` | ✅ |
| **Guard ABI** | `packages/guards/src/GuardABI.ts` | ✅ |
| **Reference gateway (α)** | `packages/gateway/` | 🚧 |
| **Examples** | `docs/examples/` | ✅ minimal & [payroll](docs/examples/payroll-graph.yaml) |

---

## 🏃 Quick start

```bash
# 1. Clone & install
git clone https://github.com/agenticaivc/intentive.git
cd intentive && npm ci

# 2. Run schema tests
npm run schema:test      # validates YAML examples

# 3. Try the payroll example
cat docs/examples/payroll-graph.yaml  # view the complete payroll workflow

# 4. Spin up the gateway (will prompt for OpenAI key)
npm run dev
```

Open <http://localhost:4000/console>, paste:

```
Process payroll for 2025-05
```

and watch the guard checks fire.

---

## 📜 Documentation
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
