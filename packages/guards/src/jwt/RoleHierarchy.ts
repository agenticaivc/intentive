import { RoleCheckResult } from './types';

export interface RoleExpression {
  or: Array<{ and: string[] }>;
}

export class RoleHierarchy {
  private hierarchy: Map<string, Set<string>>;

  constructor(config: Record<string, string[]>) {
    this.hierarchy = this.buildHierarchy(config);
  }

  /**
   * Shared role expression parser - can be used by other guards
   * Parses expressions like "finance_admin+payroll_manager,admin"
   */
  static parseRoleExpression(required: string): RoleExpression {
    // Parse "finance_admin+payroll_manager,admin" -> [[finance_admin,payroll_manager], [admin]]
    const orGroups = required.split(',').map(group => ({
      and: group.trim().split('+').map(role => role.trim()).filter(Boolean)
    })).filter(group => group.and.length > 0);
    
    return { or: orGroups };
  }

  /**
   * Get all effective roles including inherited ones
   */
  getEffectiveRoles(userRoles: string[]): string[] {
    const effective = new Set<string>();
    
    for (const role of userRoles) {
      effective.add(role);
      this.addInheritedRoles(role, effective);
    }
    
    return Array.from(effective);
  }

  /**
   * Check if user has required permissions based on role expression
   */
  checkPermission(userRoles: string[], requiredRoles: string): RoleCheckResult {
    const effective = this.getEffectiveRoles(userRoles);
    const parsed = RoleHierarchy.parseRoleExpression(requiredRoles);
    
    // Check OR conditions (comma-separated groups)
    for (const orGroup of parsed.or) {
      if (this.hasAllRoles(effective, orGroup.and)) {
        return {
          hasAccess: true,
          missingRoles: [],
          effectiveRoles: effective,
          matchedExpression: orGroup.and.join('+')
        };
      }
    }

    return {
      hasAccess: false,
      missingRoles: this.getMissingRoles(effective, parsed),
      effectiveRoles: effective
    };
  }

  private addInheritedRoles(role: string, effective: Set<string>): void {
    const inherited = this.hierarchy.get(role);
    if (inherited) {
      for (const inheritedRole of inherited) {
        if (!effective.has(inheritedRole)) {
          effective.add(inheritedRole);
          this.addInheritedRoles(inheritedRole, effective);
        }
      }
    }
  }

  private hasAllRoles(userRoles: string[], requiredRoles: string[]): boolean {
    return requiredRoles.every(role => userRoles.includes(role));
  }

  private getMissingRoles(userRoles: string[], parsed: RoleExpression): string[] {
    // Return the minimal missing roles from the first OR group
    if (parsed.or.length === 0) return [];
    
    const firstGroup = parsed.or[0];
    return firstGroup.and.filter(role => !userRoles.includes(role));
  }

  private buildHierarchy(config: Record<string, string[]>): Map<string, Set<string>> {
    const hierarchy = new Map<string, Set<string>>();
    
    for (const [parent, children] of Object.entries(config)) {
      hierarchy.set(parent, new Set(children));
    }
    
    return hierarchy;
  }
} 