# JWT + RBAC Guard Plugin

The JWT Guard provides JWT-based authentication and role-based access control (RBAC) for intent graph operations.

## 🚀 Quick Start

⚠️ **Security Warning**: Don't paste your HS256 secret into the YAML—use environment variables.

```bash
export JWT_SECRET=$(openssl rand -hex 32)
export JWKS_URI=https://auth.example.com/.well-known/jwks.json
```

## 📋 Configuration

### guard.jwt.yaml
```yaml
# Key configuration (use one approach)
secret: ${JWT_SECRET}           # For HS256 (symmetric)
jwksUri: ${JWKS_URI}           # For RS256/ES256/PS256 (asymmetric)
publicKey: ${JWT_PUBLIC_KEY}    # For RS256/ES256/PS256 (static key)

# JWT verification settings
algorithms: [RS256, ES256]     # Supported algorithms
clockSkewSeconds: 120          # Clock tolerance (default: 2 minutes)
jwksCacheMaxAge: 300000       # JWKS cache duration in ms (default: 5 minutes)

# Role configuration
roleClaim: roles              # JWT claim containing user roles
hierarchy:                    # Role inheritance (admin > manager > user)
  admin: [manager]
  manager: [user]
defaultRequired: user

# Audit settings
audit:
  enabled: true
  logLevel: info
  rateLimitWindowMs: 30000    # Rate limit error logging
  maxErrorsPerWindow: 1
```

### Environment Variables
```bash
# Required for HS256
export JWT_SECRET="your-secret-key"

# Required for RS256/ES256/PS256 with JWKS
export JWKS_URI="https://auth.example.com/.well-known/jwks.json"

# Alternative: Static public key
export JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# Optional overrides
export JWT_ALGORITHMS="HS256,RS256"
export GUARD_ROLE_CLAIM="authorities"
export JWT_CLOCK_SKEW_SECONDS="300"
```

## 🛡️ Usage in Intent Graphs

### Basic Configuration
```yaml
guards:
  - name: jwt_guard
    type: rbac
    apply_to:
      nodes: ["*"]
    config:
      type: jwt
      algorithm: RS256
      jwksUri: https://auth.mycorp.com/.well-known/jwks.json
      requiredRoles: "finance_manager+payroll_admin,admin"
```

### Role Expression Examples

| Expression | Description |
|------------|-------------|
| `admin` | User must have `admin` role |
| `finance+manager` | User must have BOTH `finance` AND `manager` roles |
| `finance_admin,admin` | User must have EITHER `finance_admin` OR `admin` role |
| `finance+manager,admin` | User must have (`finance` AND `manager`) OR `admin` |

### Role Hierarchy
With the default hierarchy `admin > manager > user`:

- An `admin` user can access endpoints requiring `manager` or `user`
- A `manager` user can access endpoints requiring `user`
- A `user` can only access endpoints requiring `user`

## 📡 HTTP Integration

### Authorization Headers
```bash
# Bearer token (standard)
curl -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." /api/intent

# Direct JWT parameter (testing/CLI)
curl -d '{"jwt": "eyJhbGciOiJSUzI1NiIs..."}' /api/intent
```

### JWT Claims Structure
```json
{
  "sub": "user-123",
  "roles": ["finance_manager", "payroll_admin"],
  "scope": "read write admin",
  "authorities": ["ROLE_ADMIN"],
  "exp": 1672531200,
  "iat": 1672527600
}
```

## 🔒 Security Features

### JWT Verification
- **HS256**: HMAC with SHA-256 (symmetric keys)
- **RS256**: RSA Signature with SHA-256 (asymmetric keys)
- **ES256**: ECDSA using P-256 and SHA-256
- **PS256**: RSASSA-PSS using SHA-256

### Clock Skew Protection
- Configurable tolerance (default: ±2 minutes)
- Prevents timing attacks on token expiration

### Rate Limiting
- Error log throttling prevents spam
- Configurable window and max errors

### JWKS Support
- Automatic key rotation via JWKS URI
- Configurable cache duration
- Cooldown between refresh attempts

## 🧪 Testing

### Unit Tests
```bash
npm test -- --testPathPattern=jwt
```

### Integration Testing
```typescript
import { JwtGuard } from '@intentive/guards';

// Test with HS256
const guard = new JwtGuard({
  algorithms: ['HS256'],
  secret: 'test-secret'
});

// Test with JWKS
const guardJwks = new JwtGuard({
  algorithms: ['RS256'],
  jwksUri: 'https://test-auth.example.com/.well-known/jwks.json'
});
```

## 🐛 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INTENTIVE_JWT_INVALID` | 401 | Invalid signature, expired, or malformed token |
| `INTENTIVE_INSUFFICIENT_PERMISSIONS` | 403 | Valid token but missing required roles |

## 📊 Audit Logging

The guard emits structured logs for security monitoring:

```json
{
  "event": "jwt_guard",
  "stage": "execute",
  "status": "success",
  "userId": "user-123",
  "effectiveRoles": ["admin", "manager", "user"],
  "matchedExpression": "admin"
}
```

### Blocked Access Logs
```json
{
  "event": "jwt_guard", 
  "stage": "execute",
  "status": "block",
  "nodeOrEdgeId": "payroll-disbursement",
  "missingRoles": ["finance_admin"],
  "userRoles": ["user"]
}
```

## 🚀 Performance

### Optimizations
- AsyncLocalStorage prevents event loop blocking
- JWKS caching reduces network calls  
- Pre-computed hierarchy lookups
- Rate-limited error logging

### Recommended Settings
- **Production**: Use RS256 with JWKS rotation
- **Development**: HS256 with base64-encoded secrets
- **CI/CD**: Mock mode with test fixtures

## 🔧 Advanced Configuration

### Custom Role Claims
```yaml
roleClaim: authorities  # Extract from 'authorities' instead of 'roles'
```

### Multiple Algorithms
```yaml
algorithms: [RS256, ES256, PS256]  # Support multiple signing algorithms
```

### Base64 Secrets
```yaml
secret: base64:dGVzdC1zZWNyZXQta2V5  # Auto-decode base64 prefixed secrets
```

## 🤝 Integration Examples

### With Express.js
```typescript
app.use('/api/secure', async (req, res, next) => {
  const guard = new JwtGuard();
  const result = await guard.execute({
    parameters: { authorization: req.headers.authorization },
    // ... other GuardInput fields
  });
  
  if (result.status === 'block') {
    return res.status(result.meta.httpStatus).json({
      error: result.message,
      code: result.meta.code
    });
  }
  
  req.user = result.meta;
  next();
});
```

### With GraphQL
```typescript
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const guard = new JwtGuard();
    const authResult = await guard.execute({
      parameters: { authorization: req.headers.authorization }
    });
    
    return { 
      user: authResult.status === 'success' ? authResult.meta : null 
    };
  }
});
``` 