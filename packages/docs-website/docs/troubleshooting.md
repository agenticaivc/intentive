---
sidebar_position: 5
---

# Troubleshooting

Common issues and solutions from real deployments.

## 🚨 Installation Issues

### "Node version not supported"
```
Error: The engine "node" is incompatible with this module
```

**Solution:** Update to Node.js 18+ LTS
```bash
# Using n (macOS/Linux)
npx n lts

# Using nvm
nvm install --lts && nvm use --lts

# Verify version
node --version  # Should be v18.x.x or higher
```

### "pnpm command not found" 
```
bash: pnpm: command not found
```

**Solution:** Install pnpm package manager
```bash
# Official installer (cross-platform)
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Via npm
npm install -g pnpm

# Verify installation
pnpm --version
```

### "Cannot find module '/dist/server.js'"
```
Error: Cannot find module '/Users/.../intentive/dist/server.js'
```

**Solution:** Build the project first
```bash
# Build all packages
pnpm build

# Or run in development mode
pnpm dev
```

## ⚡ Runtime Issues

### Demo Fails: "GraphQL endpoint not configured"
**Solution:** Set environment variables for gateway mode
```bash
export GRAPHQL_ENDPOINT=http://localhost:3000/graphql
export USE_ROUTER_CONFIG=true
pnpm payroll:demo
```

### Slow Execution (>15 seconds)
**Check:** Resource constraints
```bash
# Monitor CPU/memory during demo
top -pid $(pgrep -f "node.*payroll-demo")

# Run with verbose logging
DEBUG=intentive:* pnpm payroll:demo
```

## 🔒 Permission Issues

### "RBAC guard failed: insufficient permissions"
**Solution:** Demo uses mock user with required roles
```typescript
// In payroll-demo.ts, user context includes:
user: {
  roles: ['payroll_admin', 'finance_manager'],
  permissions: ['payroll:read', 'payroll:write']
}
```

## 🆘 Still Stuck?

1. **Check our [GitHub Issues](https://github.com/agenticaivc/intentive/issues)**
2. **Join the [Discord community](https://discord.gg/intentive)**  
3. **File a bug report** with:
   - Node.js version (`node --version`)
   - Operating system 
   - Full error output
   - Steps to reproduce

## Quick Links

- [Getting Started](./getting-started) - Back to setup
- [API Reference](./api) - Technical documentation 