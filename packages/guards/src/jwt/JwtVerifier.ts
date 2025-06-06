import { jwtVerify, createRemoteJWKSet, importSPKI, type JWTPayload } from 'jose';
import { JwtConfig, JwtClaims } from './types';
import { JwtVerificationError } from '../jwt-errors';

// AsyncLocalStorage polyfill for non-Node environments
const als = (globalThis as any).AsyncLocalStorage 
  ? new ((globalThis as any).AsyncLocalStorage)()
  : { run: <T>(_: any, fn: () => T) => fn() }; // noop shim for Cloudflare Workers etc.

export class JwtVerifier {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;
  private publicKey?: CryptoKey;
  private secretKey?: Uint8Array;

  constructor(private config: JwtConfig) {}

  async init(): Promise<void> {
    if (this.config.jwksUri) {
      this.jwks = createRemoteJWKSet(
        new URL(this.config.jwksUri),
        {
          cacheMaxAge: this.config.jwksCacheMaxAge,
          cooldownDuration: 5000 // 5s cooldown between refresh attempts
        }
      );
    } else if (this.config.publicKey) {
      // Precompute key for performance
      this.publicKey = await importSPKI(this.config.publicKey, this.config.algorithms[0]);
    } else if (this.config.secret) {
      // Support both raw and base64-encoded secrets
      this.secretKey = this.config.secret.startsWith('base64:')
        ? Buffer.from(this.config.secret.slice(7), 'base64')
        : new TextEncoder().encode(this.config.secret);
    }
  }

  async verifyToken(token: string): Promise<JwtClaims> {
    try {
      // Performance guardrail with polyfill support
      return await als.run(new Map(), async () => {
        // Handle different key types for jwtVerify
        if (this.jwks) {
          const { payload } = await jwtVerify(token, this.jwks, {
            algorithms: this.config.algorithms,
            clockTolerance: this.config.clockSkewSeconds
          });
          return this.extractClaims(payload);
        } else {
          const verificationKey = await this.getVerificationKey();
          const { payload } = await jwtVerify(token, verificationKey as CryptoKey | Uint8Array, {
            algorithms: this.config.algorithms,
            clockTolerance: this.config.clockSkewSeconds
          });
          return this.extractClaims(payload);
        }
      });
    } catch (error) {
      throw new JwtVerificationError(
        `JWT verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async getVerificationKey(): Promise<CryptoKey | Uint8Array> {
    if (this.publicKey) return this.publicKey;
    if (this.secretKey) return this.secretKey;
    
    throw new JwtVerificationError('No verification key configured');
  }

  private extractClaims(payload: JWTPayload): JwtClaims {
    const roles = this.extractRoles(payload);
    
    return {
      sub: payload.sub || 'unknown',
      roles,
      exp: payload.exp,
      iat: payload.iat,
      ...payload
    };
  }

  private extractRoles(payload: JWTPayload): string[] {
    // Check custom role claim first
    if (this.config.roleClaim !== 'roles' && payload[this.config.roleClaim]) {
      const customRoles = payload[this.config.roleClaim];
      return Array.isArray(customRoles) ? customRoles.map(String) : [String(customRoles)];
    }

    // Check standard 'roles' array
    if (Array.isArray(payload.roles)) {
      return payload.roles.map(String);
    }

    // Check 'scope' space-delimited claim
    if (typeof payload.scope === 'string') {
      return payload.scope.split(' ').filter(Boolean);
    }

    return [];
  }
} 