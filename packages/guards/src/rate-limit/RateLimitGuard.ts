import { Guard, GuardCtx, GuardInput, GuardResult, GuardStatus } from '../GuardABI';
import { RedisClient } from './redis/RedisClient';
import { LuaScriptManager } from './redis/LuaScripts';
import { IpProcessor, NetworkInfo } from './network/IpProcessor';
import { ConfigManager, RateLimitConfig } from './config/ConfigManager';
import { MetricsServer } from './metrics/MetricsServer';
import { createHash } from 'crypto';

export class RateLimitGuard implements Guard {
  readonly name = 'rate_limit';
  readonly type = 'rate_limit' as const;

  private config: RateLimitConfig | null = null;
  private redisClient: RedisClient | null = null;
  private scriptManager: LuaScriptManager | null = null;
  private ipProcessor: IpProcessor | null = null;
  private configManager: ConfigManager | null = null;
  private metricsServer: MetricsServer | null = null;
  
  private emergencyBucket: Map<string, { count: number; resetTime: number }> = new Map();
  private redisHealthy: boolean = true;
  private lastRedisCheck: number = 0;
  private emergencyFallbackEnabled: boolean = false;

  async init(ctx: GuardCtx): Promise<void> {
    try {
      // Load configuration
      const configPath = process.env.RATE_LIMIT_CONFIG || './config/rate-limit.yml';
      this.configManager = new ConfigManager(configPath);
      this.config = await this.configManager.loadConfig();

      if (!this.config.enabled) {
        ctx.logger?.log('Rate limit guard disabled by configuration');
        return;
      }

      // Initialize Redis client
      this.redisClient = new RedisClient(this.config.redis);
      await this.redisClient.connect();

      // Initialize Lua script manager
      this.scriptManager = new LuaScriptManager(this.redisClient);
      await this.scriptManager.preloadScripts();

      // Initialize IP processor
      this.ipProcessor = new IpProcessor(this.config.network);

      // Start metrics server if enabled
      if (this.config.metricsEnabled) {
        this.metricsServer = new MetricsServer(
          this.config.metricsPort,
          this.config.maxMetricsCardinality
        );
        await this.metricsServer.start();
      }

      // Setup configuration reload handlers
      this.setupConfigReloadHandlers(ctx);

      // Setup Redis health monitoring
      this.setupRedisHealthMonitoring();

      // Enable dynamic config reload if configured
      if (this.config.allowDynamicReload) {
        this.configManager.enableFileWatching();
      }

      ctx.logger?.log(`Rate limit guard initialized successfully`);
      this.recordMetric('ratelimit_init_total', 1, { status: 'success' });

    } catch (error) {
      this.recordMetric('ratelimit_init_total', 1, { status: 'error' });
      throw new Error(`Failed to initialize rate limit guard: ${error}`);
    }
  }

  async validate(input: GuardInput): Promise<GuardResult> {
    return this.processRequest(input, true);
  }

  async execute(input: GuardInput): Promise<GuardResult> {
    return this.processRequest(input, false);
  }

  async cleanup(): Promise<void> {
    try {
      if (this.metricsServer) {
        await this.metricsServer.stop();
      }

      if (this.configManager) {
        this.configManager.cleanup();
      }

      if (this.redisClient) {
        await this.redisClient.disconnect();
      }

      this.emergencyBucket.clear();
    } catch (error) {
      // Log cleanup errors but don't throw
      console.error('Error during rate limit guard cleanup:', error);
    }
  }

  private async processRequest(input: GuardInput, isDryRun: boolean): Promise<GuardResult> {
    const startTime = Date.now();
    
    try {
      // Check if guard is disabled
      if (!this.config?.enabled) {
        return { status: 'success' };
      }

      // Extract network information
      const networkInfo = this.extractNetworkInfo(input);

      // Check bypass roles
      if (this.shouldBypassRateLimit(input.user.roles, networkInfo)) {
        this.recordMetric('ratelimit_requests_total', 1, { 
          status: 'bypassed', 
          reason: 'role_bypass' 
        });
        return { status: 'success', message: 'Rate limit bypassed' };
      }

      // Generate rate limiting key
      const rateLimitKey = this.generateRateLimitKey(input, networkInfo);

      // Get applicable rate limit rules
      const rules = this.getApplicableRules(input);

      // Check rate limits
      const result = await this.checkRateLimit(rateLimitKey, rules, isDryRun);

      // Record metrics
      this.recordRequestMetrics(result, networkInfo, rules);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetric('ratelimit_errors_total', 1, { 
        error: (error as Error).name,
        duration: this.getDurationBucket(duration)
      });

      // Handle Redis failures according to fail-open/fail-strict policy
      return this.handleRateLimitError(error as Error, input);
    }
  }

  private extractNetworkInfo(input: GuardInput): NetworkInfo {
    if (!this.ipProcessor) {
      throw new Error('IP processor not initialized');
    }

    // Extract IP from request context (this would come from HTTP headers)
    const clientIp = (input.parameters.clientIp as string) || '127.0.0.1';
    const xForwardedFor = input.parameters.xForwardedFor as string;

    return this.ipProcessor.processRequest(clientIp, xForwardedFor);
  }

  private shouldBypassRateLimit(userRoles: string[], networkInfo: NetworkInfo): boolean {
    if (!this.config) return false;

    // Check global bypass roles
    const globalBypass = this.config.globalRules.bypassRoles || [];
    if (globalBypass.some(role => userRoles.includes(role))) {
      return true;
    }

    // Check if IP is from trusted proxy (could indicate admin access)
    if (networkInfo.isTrustedProxy && userRoles.includes('admin')) {
      return true;
    }

    return false;
  }

  private generateRateLimitKey(input: GuardInput, networkInfo: NetworkInfo): string {
    // Prefer authenticated user ID, fall back to IP bucketing
    let baseKey: string;
    
    if (input.user.id && input.user.id !== 'anonymous') {
      baseKey = `rl:user:${this.hashUserId(input.user.id)}`;
    } else {
      baseKey = `rl:ip:${networkInfo.bucketKey}`;
    }

    // Add HTTP method and path suffix
    const method = (input.parameters.method as string) || 'UNKNOWN';
    const path = (input.parameters.path as string) || input.nodeOrEdgeId;
    const pathHash = this.hashPath(path);

    return `${baseKey}:${method}:${pathHash}`;
  }

  private getApplicableRules(input: GuardInput) {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    // Look for endpoint-specific rules first
    const method = (input.parameters.method as string) || 'GET';
    const path = (input.parameters.path as string) || input.nodeOrEdgeId;

    for (const endpointRule of this.config.endpointRules) {
      if (this.pathMatches(path, endpointRule.path)) {
        if (!endpointRule.method || endpointRule.method === method) {
          return endpointRule.rules;
        }
      }
    }

    // Fall back to global rules
    return this.config.globalRules;
  }

  private pathMatches(requestPath: string, rulePath: string): boolean {
    // Simple wildcard matching for now
    if (rulePath.includes('*')) {
      const regex = new RegExp('^' + rulePath.replace(/\*/g, '.*') + '$');
      return regex.test(requestPath);
    }
    return requestPath === rulePath;
  }

  private async checkRateLimit(key: string, rules: any, isDryRun: boolean): Promise<GuardResult> {
    const currentTime = Math.floor(Date.now() / 1000);

    try {
      // Use Redis if healthy
      if (this.redisHealthy && this.scriptManager) {
        return await this.checkRateLimitRedis(key, rules, currentTime, isDryRun);
      } else {
        // Fall back to emergency in-memory bucket
        return this.checkRateLimitEmergency(key, rules, currentTime);
      }
    } catch (error) {
      // Mark Redis as unhealthy
      this.redisHealthy = false;
      this.lastRedisCheck = Date.now();
      
      return this.checkRateLimitEmergency(key, rules, currentTime);
    }
  }

  private async checkRateLimitRedis(key: string, rules: any, currentTime: number, isDryRun: boolean): Promise<GuardResult> {
    if (!this.scriptManager) {
      throw new Error('Script manager not initialized');
    }

    // Execute sliding window check
    const result = await this.scriptManager.executeSlidingWindow(
      key,
      rules.windowSeconds,
      rules.maxRequests,
      currentTime,
      rules.burstLimit
    );

    const status: GuardStatus = result.isBlocked || result.isBurstBlocked ? 'block' : 'success';
    const retryAfterMs = result.retryAfterSeconds * 1000;

    // For fail-strict mode, return 503 when Redis fails
    if (!this.config?.failOpen && !this.redisHealthy) {
      return {
        status: 'block',
        message: 'Rate limit service unavailable',
        retryAfterMs: 30000, // 30 second retry
        meta: { reason: 'redis_unavailable', mode: 'fail_strict' }
      };
    }

    return {
      status,
      message: result.isBlocked ? 'Rate limit exceeded' : 
               result.isBurstBlocked ? 'Burst limit exceeded' : undefined,
      retryAfterMs: status === 'block' ? retryAfterMs : undefined,
      meta: {
        totalRequests: result.totalRequests,
        remaining: result.remaining,
        windowSeconds: rules.windowSeconds,
        source: 'redis'
      }
    };
  }

  private checkRateLimitEmergency(key: string, rules: any, currentTime: number): GuardResult {
    // Emergency in-memory rate limiting
    const windowStart = currentTime - rules.windowSeconds;
    const bucket = this.emergencyBucket.get(key);

    // Reset bucket if window expired
    if (!bucket || bucket.resetTime <= windowStart) {
      this.emergencyBucket.set(key, { count: 1, resetTime: currentTime });
      return { 
        status: 'success',
        meta: { remaining: rules.maxRequests - 1, source: 'emergency' }
      };
    }

    // Check if limit exceeded
    if (bucket.count >= rules.maxRequests) {
      return {
        status: 'block',
        message: 'Rate limit exceeded (emergency mode)',
        retryAfterMs: (rules.windowSeconds * 1000),
        meta: { remaining: 0, source: 'emergency' }
      };
    }

    // Increment counter
    bucket.count++;
    
    return { 
      status: 'success',
      meta: { remaining: rules.maxRequests - bucket.count, source: 'emergency' }
    };
  }

  private handleRateLimitError(error: Error, input: GuardInput): GuardResult {
    if (!this.config) {
      return { status: 'block', message: 'Configuration not available' };
    }

    // For fail-strict mode, block requests when Redis is unavailable for too long
    if (!this.config.failOpen) {
      const redisDownTime = Date.now() - this.lastRedisCheck;
      if (redisDownTime > this.config.failStrictTimeoutMs) {
        return {
          status: 'block',
          message: 'Rate limit service unavailable',
          retryAfterMs: 30000,
          meta: { error: error.message, mode: 'fail_strict' }
        };
      }
    }

    // Fail-open mode: allow requests to proceed
    return { 
      status: 'success', 
      message: 'Rate limit check failed, allowing request',
      meta: { error: error.message, mode: 'fail_open' }
    };
  }

  private setupConfigReloadHandlers(ctx: GuardCtx): void {
    if (!this.configManager) return;

    this.configManager.on('config.reloaded', async (event) => {
      try {
        this.config = this.configManager!.getCurrentConfig();
        ctx.logger?.log(`Configuration reloaded: ${event.version} (${event.reason})`);
        this.recordMetric('ratelimit_config_reloads_total', 1, { 
          status: 'success', 
          reason: event.reason 
        });
      } catch (error) {
        ctx.logger?.error(`Failed to apply reloaded configuration: ${error}`);
        this.recordMetric('ratelimit_config_reloads_total', 1, { 
          status: 'error', 
          reason: event.reason 
        });
      }
    });
  }

  private setupRedisHealthMonitoring(): void {
    if (!this.redisClient) return;

    // Monitor Redis connection health
    this.redisClient.on('connect', () => {
      this.redisHealthy = true;
      this.recordMetric('ratelimit_redis_status', 1, { status: 'connected' });
    });

    this.redisClient.on('error', () => {
      this.redisHealthy = false;
      this.lastRedisCheck = Date.now();
      this.recordMetric('ratelimit_redis_status', 1, { status: 'error' });
    });

    // Periodic health check
    setInterval(async () => {
      if (this.redisClient?.isConnected()) {
        try {
          await this.redisClient.ping();
          this.redisHealthy = true;
        } catch (error) {
          this.redisHealthy = false;
          this.lastRedisCheck = Date.now();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private recordRequestMetrics(result: GuardResult, networkInfo: NetworkInfo, rules: any): void {
    const labels = {
      status: result.status,
      source: String(result.meta?.source || 'unknown'),
      ip_type: networkInfo.isIpv6 ? 'ipv6' : 'ipv4',
      window: String(rules.windowSeconds)
    };

    this.recordMetric('ratelimit_requests_total', 1, labels);

    if (result.status === 'block') {
      this.recordMetric('ratelimit_blocks_total', 1, labels);
    }

    // Record remaining capacity as gauge
    if (typeof result.meta?.remaining === 'number') {
      this.recordMetric('ratelimit_remaining_capacity', result.meta.remaining, labels);
    }
  }

  private recordMetric(name: string, value: number, labels: Record<string, string> = {}): void {
    if (this.metricsServer) {
      this.metricsServer.recordMetric(name, value, labels);
    }
  }

  private hashUserId(userId: string): string {
    return createHash('sha256').update(userId).digest('hex').substring(0, 16);
  }

  private hashPath(path: string): string {
    return createHash('sha256').update(path).digest('hex').substring(0, 8);
  }

  private getDurationBucket(durationMs: number): string {
    if (durationMs < 1) return '<1ms';
    if (durationMs < 10) return '<10ms';
    if (durationMs < 100) return '<100ms';
    if (durationMs < 1000) return '<1s';
    return '>=1s';
  }

  // Emergency bucket cleanup to prevent memory leaks
  private cleanupEmergencyBucket(): void {
    const now = Date.now() / 1000;
    const maxSize = 10000; // Prevent unbounded growth
    
    if (this.emergencyBucket.size > maxSize) {
      // Remove oldest entries
      const entries = Array.from(this.emergencyBucket.entries());
      entries.sort((a, b) => a[1].resetTime - b[1].resetTime);
      
      for (let i = 0; i < entries.length - maxSize * 0.8; i++) {
        this.emergencyBucket.delete(entries[i][0]);
      }
    }
  }
}
