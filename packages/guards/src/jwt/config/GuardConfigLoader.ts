import { readFileSync } from 'fs';
import { JwtConfigSchema, type JwtConfig } from './schemas';

export class GuardConfigLoader {
  static load(overrides?: Partial<JwtConfig>): JwtConfig {
    // Load from environment
    const envConfig = this.loadFromEnv();
    
    // Load from YAML file if exists
    const yamlConfig = this.loadFromYaml('config/guard.jwt.yaml');

    // Merge configurations: defaults < yaml < env < overrides
    const rawConfig = {
      ...yamlConfig,
      ...envConfig,
      ...overrides
    };

    // Validate with Zod schema
    try {
      return JwtConfigSchema.parse(rawConfig);
    } catch (error) {
      throw new Error(`JWT Guard configuration validation failed: ${error}`);
    }
  }

  private static loadFromEnv(): Partial<JwtConfig> {
    const config: any = {};
    
    if (process.env.JWT_SECRET) {
      config.secret = process.env.JWT_SECRET;
    }
    
    if (process.env.JWT_PUBLIC_KEY) {
      config.publicKey = process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
    }
    
    if (process.env.JWT_ALGORITHMS) {
      config.algorithms = process.env.JWT_ALGORITHMS.split(',').map(s => s.trim());
    }
    
    if (process.env.JWKS_URI) {
      config.jwksUri = process.env.JWKS_URI;
    }
    
    if (process.env.GUARD_ROLE_CLAIM) {
      config.roleClaim = process.env.GUARD_ROLE_CLAIM;
    }

    if (process.env.JWT_CLOCK_SKEW_SECONDS) {
      config.clockSkewSeconds = parseInt(process.env.JWT_CLOCK_SKEW_SECONDS, 10);
    }

    return config;
  }

  private static loadFromYaml(path: string): Partial<JwtConfig> {
    try {
      const content = readFileSync(path, 'utf8');
      const expanded = this.expandEnvVars(content);
      // Note: YAML parsing would require yaml library, using JSON.parse for now
      // In production, this would use yaml.parse(expanded)
      return JSON.parse(expanded);
    } catch (error) {
      // YAML file is optional
      return {};
    }
  }

  private static expandEnvVars(content: string): string {
    return content.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      const value = process.env[envVar];
      if (value === undefined) {
        throw new Error(`Environment variable ${envVar} is not defined`);
      }
      return value;
    });
  }
} 