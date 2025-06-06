import { RedisClient } from './RedisClient';

export interface ScriptManager {
  preloadScripts(): Promise<void>;
  getSlidingWindowSha(): string;
  getSequenceTtlSha(): string;
  executeScript(sha: string, keys: string[], args: string[]): Promise<any>;
}

// Sliding window rate limiting script with 1-second granularity
const SLIDING_WINDOW_SCRIPT = `
-- KEYS[1]: rate limit key prefix (e.g., "rl:user:123" or "rl:ip:192.168.1.1")
-- ARGV[1]: window size in seconds
-- ARGV[2]: max requests
-- ARGV[3]: current timestamp (seconds)
-- ARGV[4]: burst limit (optional, defaults to max requests)

local key = KEYS[1]
local window_size = tonumber(ARGV[1])
local max_requests = tonumber(ARGV[2])
local current_time = tonumber(ARGV[3])
local burst_limit = tonumber(ARGV[4]) or max_requests

-- Create sliding window buckets
local bucket_key = key .. ':bucket:' .. math.floor(current_time)
local bucket_count = redis.call('INCR', bucket_key)

-- Set expiration only on first increment to avoid constant TTL updates
if bucket_count == 1 then
    redis.call('EXPIRE', bucket_key, window_size + 1)
end

-- Count requests in sliding window
local total_requests = 0
for i = 0, window_size - 1 do
    local bucket_time = current_time - i
    local bucket = key .. ':bucket:' .. bucket_time
    local count = redis.call('GET', bucket)
    if count then
        total_requests = total_requests + tonumber(count)
    end
end

-- Check limits
local is_blocked = total_requests > max_requests
local is_burst_blocked = bucket_count > burst_limit
local remaining = math.max(0, max_requests - total_requests)

-- Return: [is_blocked, is_burst_blocked, total_requests, remaining, retry_after_seconds]
local retry_after = 0
if is_blocked or is_burst_blocked then
    retry_after = window_size
end

return {is_blocked and 1 or 0, is_burst_blocked and 1 or 0, total_requests, remaining, retry_after}
`;

// Script to manage sequence key TTL for pre-warming
const SEQUENCE_TTL_SCRIPT = `
-- KEYS[1]: sequence key pattern (e.g., "seq:user:123")
-- ARGV[1]: TTL in seconds
-- ARGV[2]: current timestamp

local pattern = KEYS[1]
local ttl = tonumber(ARGV[1])
local current_time = tonumber(ARGV[2])

-- Use SETNX to atomically create and set TTL
local key = pattern .. ':' .. current_time
local result = redis.call('SETNX', key, '1')

if result == 1 then
    -- Key was created, set expiration
    redis.call('EXPIRE', key, ttl)
    return {key, 1}  -- [created_key, was_created]
else
    -- Key already exists
    return {key, 0}
end
`;

export class LuaScriptManager implements ScriptManager {
  private redisClient: RedisClient;
  private slidingWindowSha: string = '';
  private sequenceTtlSha: string = '';
  private scriptsLoaded: boolean = false;

  constructor(redisClient: RedisClient) {
    this.redisClient = redisClient;
  }

  async preloadScripts(): Promise<void> {
    try {
      // Load both scripts and store their SHA hashes
      this.slidingWindowSha = await this.redisClient.scriptLoad(SLIDING_WINDOW_SCRIPT);
      this.sequenceTtlSha = await this.redisClient.scriptLoad(SEQUENCE_TTL_SCRIPT);
      
      this.scriptsLoaded = true;
      
      // Emit success event for monitoring
      this.redisClient.emit('ratelimit.lua.scripts_loaded', {
        slidingWindowSha: this.slidingWindowSha,
        sequenceTtlSha: this.sequenceTtlSha,
      });
    } catch (error) {
      this.redisClient.emit('ratelimit.lua.scripts_failed', { error });
      throw new Error(`Failed to preload Lua scripts: ${error}`);
    }
  }

  getSlidingWindowSha(): string {
    if (!this.scriptsLoaded) {
      throw new Error('Scripts not loaded. Call preloadScripts() first.');
    }
    return this.slidingWindowSha;
  }

  getSequenceTtlSha(): string {
    if (!this.scriptsLoaded) {
      throw new Error('Scripts not loaded. Call preloadScripts() first.');
    }
    return this.sequenceTtlSha;
  }

  async executeScript(sha: string, keys: string[], args: string[]): Promise<any> {
    try {
      return await this.redisClient.evalsha(sha, keys, args);
    } catch (error: any) {
      // Handle NOSCRIPT error by reloading and retrying
      if (error.message && error.message.includes('NOSCRIPT')) {
        await this.preloadScripts();
        return await this.redisClient.evalsha(sha, keys, args);
      }
      throw error;
    }
  }

  // Execute sliding window rate limit check
  async executeSlidingWindow(
    keyPrefix: string,
    windowSeconds: number,
    maxRequests: number,
    currentTimeSeconds: number,
    burstLimit?: number
  ): Promise<{
    isBlocked: boolean;
    isBurstBlocked: boolean;
    totalRequests: number;
    remaining: number;
    retryAfterSeconds: number;
  }> {
    const args = [
      String(windowSeconds),
      String(maxRequests),
      String(currentTimeSeconds),
      String(burstLimit || maxRequests),
    ];

    const result = await this.executeScript(this.getSlidingWindowSha(), [keyPrefix], args);
    
    return {
      isBlocked: result[0] === 1,
      isBurstBlocked: result[1] === 1,
      totalRequests: result[2],
      remaining: result[3],
      retryAfterSeconds: result[4],
    };
  }

  // Execute sequence key creation with TTL
  async executeSequenceTtl(
    keyPattern: string,
    ttlSeconds: number,
    currentTimeSeconds: number
  ): Promise<{
    createdKey: string;
    wasCreated: boolean;
  }> {
    const args = [String(ttlSeconds), String(currentTimeSeconds)];
    const result = await this.executeScript(this.getSequenceTtlSha(), [keyPattern], args);
    
    return {
      createdKey: result[0],
      wasCreated: result[1] === 1,
    };
  }
} 