import { Guard, GuardCtx, GuardInput, GuardResult } from '../../packages/guards/src/GuardABI';

interface RbacConfig {
  type: 'rbac';
  requiredRoles: string[];
  requiredPermissions?: string[];
  allowSuperuser?: boolean;
}

export class RbacGuard implements Guard {
  readonly name = 'rbac';
  readonly type = 'rbac' as const;
  
  private config!: RbacConfig;

  constructor(config: RbacConfig) {
    this.config = config;
  }

  async init(ctx: GuardCtx): Promise<void> {
    ctx.logger?.info(`RBAC guard initialized for execution ${ctx.executionId}`);
  }

  async validate(i: GuardInput): Promise<GuardResult> {
    return this.checkAccess(i, true);
  }

  async execute(i: GuardInput): Promise<GuardResult> {
    return this.checkAccess(i, false);
  }

  private checkAccess(input: GuardInput, dryRun: boolean): GuardResult {
    const { user } = input;
    
    // Check superuser bypass
    if (this.config.allowSuperuser && user.roles.includes('superuser')) {
      return {
        status: 'success',
        message: 'Superuser access granted',
        meta: { bypass: 'superuser', dryRun }
      };
    }

    // Check required roles
    const hasRequiredRole = this.config.requiredRoles.some(role => 
      user.roles.includes(role)
    );

    if (!hasRequiredRole) {
      return {
        status: 'block',
        message: `Access denied: requires one of roles [${this.config.requiredRoles.join(', ')}]`,
        meta: { userRoles: user.roles, dryRun }
      };
    }

    // Check required permissions if specified
    if (this.config.requiredPermissions) {
      const hasRequiredPermission = this.config.requiredPermissions.every(perm =>
        user.permissions.includes(perm)
      );

      if (!hasRequiredPermission) {
        return {
          status: 'block',
          message: `Access denied: missing required permissions [${this.config.requiredPermissions.join(', ')}]`,
          meta: { requiredPermissions: this.config.requiredPermissions, userPermissions: user.permissions, dryRun }
        };
      }
    }

    return {
      status: 'success',
      message: 'RBAC access granted',
      meta: { dryRun }
    };
  }

  async cleanup(): Promise<void> {
    // Cleanup any resources if needed
  }
} 