import Ajv from 'ajv';
import * as fs from 'fs';
import * as path from 'path';

describe('Guard Config Schema', () => {
  let ajv: Ajv;
  let schema: any;

  beforeAll(() => {
    ajv = new Ajv();
    const schemaPath = path.join(__dirname, '../../../docs/schemas/guard-config-schema.json');
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  });

  describe('RBAC Config', () => {
    it('should validate valid RBAC config', () => {
      const config = {
        type: 'rbac',
        requiredRoles: ['admin', 'user'],
        allowSuperuser: true
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(true);
    });

    it('should validate RBAC config with required permissions', () => {
      const config = {
        type: 'rbac',
        requiredRoles: ['admin'],
        requiredPermissions: ['read', 'write'],
        allowSuperuser: false
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(true);
    });

    it('should reject RBAC config without required roles', () => {
      const config = {
        type: 'rbac'
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '',
          schemaPath: '#/definitions/rbacConfig/required',
          keyword: 'required',
          params: { missingProperty: 'requiredRoles' }
        })
      );
    });

    it('should reject RBAC config with empty required roles', () => {
      const config = {
        type: 'rbac',
        requiredRoles: []
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/requiredRoles',
          keyword: 'minItems'
        })
      );
    });

    it('should reject RBAC config with additional properties', () => {
      const config = {
        type: 'rbac',
        requiredRoles: ['admin'],
        invalidProperty: 'should fail'
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'additionalProperties'
        })
      );
    });
  });

  describe('Rate Limit Config', () => {
    it('should validate valid rate limit config', () => {
      const config = {
        type: 'rate_limit',
        maxRequests: 100,
        windowMs: 60000,
        keyGenerator: 'user'
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(true);
    });

    it('should validate rate limit config without optional keyGenerator', () => {
      const config = {
        type: 'rate_limit',
        maxRequests: 50,
        windowMs: 30000
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(true);
    });

    it('should reject rate limit config without maxRequests', () => {
      const config = {
        type: 'rate_limit',
        windowMs: 60000
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'required',
          params: { missingProperty: 'maxRequests' }
        })
      );
    });

    it('should reject rate limit config with invalid maxRequests', () => {
      const config = {
        type: 'rate_limit',
        maxRequests: 0,
        windowMs: 60000
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/maxRequests',
          keyword: 'minimum'
        })
      );
    });

    it('should reject rate limit config with invalid windowMs', () => {
      const config = {
        type: 'rate_limit',
        maxRequests: 100,
        windowMs: 500  // Below minimum of 1000
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/windowMs',
          keyword: 'minimum'
        })
      );
    });

    it('should reject rate limit config with invalid keyGenerator', () => {
      const config = {
        type: 'rate_limit',
        maxRequests: 100,
        windowMs: 60000,
        keyGenerator: 'invalid'
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/keyGenerator',
          keyword: 'enum'
        })
      );
    });
  });

  describe('Invalid Guard Types', () => {
    it('should reject config with unsupported guard type', () => {
      const config = {
        type: 'audit',  // Not supported in v0.1
        logLevel: 'info'
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'anyOf'
        })
      );
    });

    it('should reject config without type', () => {
      const config = {
        requiredRoles: ['admin']
      };
      
      const validate = ajv.compile(schema);
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'anyOf'
        })
      );
    });
  });
}); 