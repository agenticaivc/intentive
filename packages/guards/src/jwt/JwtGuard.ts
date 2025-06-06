import { Guard, GuardCtx, GuardInput, GuardResult } from '../GuardABI';
import { JwtVerifier } from './JwtVerifier';
import { RoleHierarchy } from './RoleHierarchy';
import { GuardConfigLoader } from './config/GuardConfigLoader';
import { JwtConfig } from './types';

export class JwtGuard implements Guard {
  readonly name = 'jwt';
  readonly type = 'rbac' as const;

  private verifier: JwtVerifier;
  private hierarchy: RoleHierarchy;
  private config: JwtConfig;
  private logger?: typeof console;

  constructor(config?: Partial<JwtConfig>) {
    this.config = GuardConfigLoader.load(config);
    this.verifier = new JwtVerifier(this.config);
    this.hierarchy = new RoleHierarchy(this.config.hierarchy);
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
      
      // Extract node requirements
      const requiredRoles = this.getRequiredRoles(input);
      if (!requiredRoles) {
        // No role requirements specified - just validate token
        return {
          status: 'success',
          message: 'JWT authentication successful (no role requirements)',
          meta: { 
            userId: claims.sub,
            roles: claims.roles || [],
            stage
          }
        };
      }

      // Check role permissions using hierarchy
      const roleCheck = this.hierarchy.checkPermission(claims.roles || [], requiredRoles);
      
      if (!roleCheck.hasAccess) {
        return this.createForbiddenResult(roleCheck, input, stage);
      }

      this.logger?.info(`JWT Guard success: ${roleCheck.matchedExpression || 'default'}`, {
        userId: claims.sub,
        effectiveRoles: roleCheck.effectiveRoles,
        matchedExpression: roleCheck.matchedExpression,
        stage
      });

      return {
        status: 'success',
        message: 'JWT authentication and authorization successful',
        meta: { 
          userId: claims.sub,
          roles: claims.roles || [],
          effectiveRoles: roleCheck.effectiveRoles,
          matchedExpression: roleCheck.matchedExpression,
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

  private getRequiredRoles(input: GuardInput): string | null {
    // Extract from guard configuration or node metadata
    const guardConfig = input.parameters.guardConfig as any;
    return guardConfig?.requiredRoles || null;
  }

  private createUnauthorizedResult(message: string): GuardResult {
    this.logger?.warn(`JWT Guard blocked: ${message}`, {
      event: 'jwt_guard',
      status: 'block',
      reason: message
    });

    return {
      status: 'block',
      message: `Unauthorized: ${message}`,
      meta: { 
        code: 'INTENTIVE_JWT_INVALID',
        httpStatus: 401
      }
    };
  }

  private createForbiddenResult(
    roleCheck: any, 
    input: GuardInput, 
    stage: string
  ): GuardResult {
    this.logger?.warn(`JWT Guard blocked: Insufficient role permissions`, {
      event: 'jwt_guard',
      stage,
      status: 'block',
      nodeOrEdgeId: input.nodeOrEdgeId,
      missingRoles: roleCheck.missingRoles,
      userRoles: roleCheck.effectiveRoles
    });

    return {
      status: 'block',
      message: 'Forbidden: Insufficient role permissions',
      meta: {
        code: 'INTENTIVE_INSUFFICIENT_PERMISSIONS',
        missingRoles: roleCheck.missingRoles,
        httpStatus: 403
      }
    };
  }

  async cleanup(): Promise<void> {
    this.logger?.info('JWT Guard cleanup completed');
  }
} 