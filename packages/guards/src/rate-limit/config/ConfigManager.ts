import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { EventEmitter } from 'events';
import { RedisConfig } from '../redis/RedisClient';
import { IpProcessorConfig } from '../network/IpProcessor';

export interface RateLimitRule {
  windowSeconds: number;
  maxRequests: number;
  burstLimit?: number;
  bypassRoles?: string[];
}

export interface EndpointConfig {
  path: string;
  method?: string;
  rules: RateLimitRule;
}

export interface RateLimitConfig {
  enabled: boolean;
  dryRun: boolean;
  failOpen: boolean;
  failStrictTimeoutMs: number;
  
  // Redis configuration
  redis: RedisConfig;
  
  // Network processing
  network: IpProcessorConfig;
  
  // Rate limiting rules
  globalRules: RateLimitRule;
  endpointRules: EndpointConfig[];
  
  // Monitoring
  metricsEnabled: boolean;
  metricsPort: number;
  maxMetricsCardinality: number;
  
  // Operational
  configVersion: string;
  allowDynamicReload: boolean;
}

export interface ConfigValidationError {
  field: string;
  error: string;
}

export class ConfigManager extends EventEmitter {
  private config: RateLimitConfig | null = null;
  private configPath: string;
  private configVersion: number = 1;
  private fsWatcher: fs.FSWatcher | null = null;

  constructor(configPath: string) {
    super();
    this.configPath = configPath;
    this.setupSignalHandlers();
  }

  async loadConfig(): Promise<RateLimitConfig> {
    try {
      const fileContent = fs.readFileSync(this.configPath, 'utf8');
      const rawConfig = yaml.load(fileContent) as any;
      
      const validatedConfig = this.validateAndNormalizeConfig(rawConfig);
      
      // Set config version
      validatedConfig.configVersion = `v${this.configVersion++}_${Date.now()}`;
      
      this.config = validatedConfig;
      this.emit('config.loaded', { version: validatedConfig.configVersion });
      
      return validatedConfig;
    } catch (error) {
      this.emit('config.load_failed', { error: (error as Error).message });
      throw new Error(`Failed to load configuration: ${error}`);
    }
  }

  getCurrentConfig(): RateLimitConfig | null {
    return this.config;
  }

  private validateAndNormalizeConfig(rawConfig: any): RateLimitConfig {
    const errors: ConfigValidationError[] = [];

    // Validate required fields
    if (typeof rawConfig.enabled !== 'boolean') {
      errors.push({ field: 'enabled', error: 'Must be boolean' });
    }

    if (!rawConfig.redis || typeof rawConfig.redis !== 'object') {
      errors.push({ field: 'redis', error: 'Redis configuration is required' });
    }

    if (!rawConfig.globalRules || typeof rawConfig.globalRules !== 'object') {
      errors.push({ field: 'globalRules', error: 'Global rules configuration is required' });
    }

    // Validate rate limiting rules
    if (rawConfig.globalRules) {
      const globalErrors = this.validateRateLimitRule(rawConfig.globalRules, 'globalRules');
      errors.push(...globalErrors);
    }

    // Validate endpoint rules
    if (rawConfig.endpointRules && Array.isArray(rawConfig.endpointRules)) {
      rawConfig.endpointRules.forEach((rule: any, index: number) => {
        if (!rule.path || typeof rule.path !== 'string') {
          errors.push({ field: `endpointRules[${index}].path`, error: 'Must be string' });
        }
        
        if (rule.rules) {
          const ruleErrors = this.validateRateLimitRule(rule.rules, `endpointRules[${index}].rules`);
          errors.push(...ruleErrors);
        }
      });
    }

    if (errors.length > 0) {
      const errorMessage = errors.map(e => `${e.field}: ${e.error}`).join('; ');
      throw new Error(`Configuration validation failed: ${errorMessage}`);
    }

    // Apply defaults
    return {
      enabled: rawConfig.enabled,
      dryRun: rawConfig.dryRun || false,
      failOpen: rawConfig.failOpen !== false, // Default to true
      failStrictTimeoutMs: rawConfig.failStrictTimeoutMs || 10000,
      
      redis: {
        url: rawConfig.redis.url || 'redis://localhost:6379',
        cluster: rawConfig.redis.cluster,
        aclUsername: rawConfig.redis.aclUsername,
        aclPassword: rawConfig.redis.aclPassword,
        password: rawConfig.redis.password,
        connectTimeout: rawConfig.redis.connectTimeout || 5000,
        commandTimeout: rawConfig.redis.commandTimeout || 5000,
        retryDelayOnFailover: rawConfig.redis.retryDelayOnFailover || 100,
        maxRetriesPerRequest: rawConfig.redis.maxRetriesPerRequest || 3,
        lazyConnect: rawConfig.redis.lazyConnect !== false,
      },
      
      network: {
        trustedProxies: rawConfig.network?.trustedProxies || ['127.0.0.1', '::1'],
        ipv6CidrBits: rawConfig.network?.ipv6CidrBits || 64,
        maxXForwardedForEntries: rawConfig.network?.maxXForwardedForEntries || 10,
        enableIpv6Bucketing: rawConfig.network?.enableIpv6Bucketing !== false,
      },
      
      globalRules: rawConfig.globalRules,
      endpointRules: rawConfig.endpointRules || [],
      
      metricsEnabled: rawConfig.metricsEnabled !== false,
      metricsPort: rawConfig.metricsPort || 9090,
      maxMetricsCardinality: rawConfig.maxMetricsCardinality || 10000,
      
      configVersion: '', // Will be set after validation
      allowDynamicReload: rawConfig.allowDynamicReload !== false,
    };
  }

  private validateRateLimitRule(rule: any, fieldPrefix: string): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];

    if (!Number.isInteger(rule.windowSeconds) || rule.windowSeconds <= 0) {
      errors.push({ field: `${fieldPrefix}.windowSeconds`, error: 'Must be positive integer' });
    }

    if (!Number.isInteger(rule.maxRequests) || rule.maxRequests <= 0) {
      errors.push({ field: `${fieldPrefix}.maxRequests`, error: 'Must be positive integer' });
    }

    // Validate burstLimit <= windowSeconds (prevent misconfiguration)
    if (rule.burstLimit !== undefined) {
      if (!Number.isInteger(rule.burstLimit) || rule.burstLimit <= 0) {
        errors.push({ field: `${fieldPrefix}.burstLimit`, error: 'Must be positive integer' });
      } else if (rule.burstLimit > rule.windowSeconds) {
        errors.push({ field: `${fieldPrefix}.burstLimit`, error: 'Cannot exceed windowSeconds' });
      }
    }

    if (rule.bypassRoles && !Array.isArray(rule.bypassRoles)) {
      errors.push({ field: `${fieldPrefix}.bypassRoles`, error: 'Must be array' });
    }

    return errors;
  }

  private setupSignalHandlers(): void {
    // Handle SIGHUP for dynamic configuration reload
    process.on('SIGHUP', async () => {
      try {
        const newConfig = await this.loadConfig();
        if (newConfig.allowDynamicReload) {
          this.emit('config.reloaded', { 
            version: newConfig.configVersion,
            reason: 'SIGHUP'
          });
        } else {
          this.emit('config.reload_disabled', { 
            reason: 'allowDynamicReload is false'
          });
        }
      } catch (error) {
        this.emit('config.reload_failed', { 
          error: (error as Error).message,
          reason: 'SIGHUP'
        });
      }
    });
  }

  enableFileWatching(): void {
    if (this.fsWatcher) return;

    try {
      this.fsWatcher = fs.watch(this.configPath, async (eventType) => {
        if (eventType === 'change') {
          // Debounce file changes
          setTimeout(async () => {
            try {
              const newConfig = await this.loadConfig();
              if (newConfig.allowDynamicReload) {
                this.emit('config.reloaded', { 
                  version: newConfig.configVersion,
                  reason: 'file_change'
                });
              }
            } catch (error) {
              this.emit('config.reload_failed', { 
                error: (error as Error).message,
                reason: 'file_change'
              });
            }
          }, 500);
        }
      });
    } catch (error) {
      this.emit('config.watch_failed', { error: (error as Error).message });
    }
  }

  disableFileWatching(): void {
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }
  }

  cleanup(): void {
    this.disableFileWatching();
    this.removeAllListeners();
  }
} 