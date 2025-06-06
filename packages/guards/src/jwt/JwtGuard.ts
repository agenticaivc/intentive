import { Guard, GuardCtx, GuardInput, GuardResult } from '../GuardABI';
import { JwtVerifier } from './JwtVerifier';
import { GuardConfigLoader } from './config/GuardConfigLoader';
import { JwtConfig } from './types';

export class JwtGuard implements Guard {
  readonly name = 'jwt';
  readonly type = 'rbac' as const;

  private verifier: JwtVerifier;
  private config: JwtConfig;
  private logger?: typeof console;

  constructor(config?: Partial<JwtConfig>) {
    this.config = GuardConfigLoader.load(config);
    this.verifier = new JwtVerifier(this.config);
  }

  async init(ctx: GuardCtx): Promise<void> {
    await this.verifier.init();
    this.logger = ctx.logger;
    
    this.logger?.info(`JWT Guard initialized for execution ${ctx.executionId}`, {
      algorithms: this.config.algorithms,
      hasJwksUri: !!this.config.jwksUri,
      clockSkewSeconds: this.config.clockSkewSeconds
    });
  }

  async validate(input: GuardInput): Promise<GuardResult> {
    return this.executeGuard(input, 'validate');
  }

  async execute(input: GuardInput): Promise<GuardResult> {
    return this.executeGuard(input, 'execute');
  }

  private async executeGuard(input: GuardInput, stage: 'validate' | 'execute'): Promise<GuardResult> {
    try {
      // Extract JWT token from parameters
      const token = this.extractToken(input);
      if (!token) {
        return this.createUnauthorizedResult('Missing or invalid Authorization header');
      }

      // Verify JWT signature and extract claims
      const claims = await this.verifier.verifyToken(token);
      
      // For MVP, simple success if token is valid
      return {
        status: 'success',
        message: 'JWT authentication successful',
        meta: { 
          userId: claims.sub,
          roles: claims.roles || [],
          stage
        }
      };

    } catch (error) {
      return this.createUnauthorizedResult(
        error instanceof Error ? error.message : 'JWT verification failed'
      );
    }
  }

  private extractToken(input: GuardInput): string | null {
    // Priority 1: parameters.authorization (Bearer token)
    const paramAuth = input.parameters.authorization || input.parameters.Authorization;
    if (typeof paramAuth === 'string' && paramAuth.startsWith('Bearer ')) {
      return paramAuth.substring(7);
    }

    // Priority 2: parameters.jwt (CLI/testing direct override)
    const directJwt = input.parameters.jwt;
    if (typeof directJwt === 'string') {
      return directJwt;
    }

    return null;
  }

  private createUnauthorizedResult(message: string): GuardResult {
    return {
      status: 'block',
      message: `Unauthorized: ${message}`,
      meta: { 
        code: 'INTENTIVE_JWT_INVALID',
        httpStatus: 401
      }
    };
  }

  async cleanup(): Promise<void> {
    this.logger?.info('JWT Guard cleanup completed');
  }
} 