import Redis, { Cluster } from 'ioredis';
import { EventEmitter } from 'events';

export interface RedisConfig {
  url?: string;
  cluster?: {
    nodes: string[];
    enableDnsDiscovery: boolean;
  };
  aclUsername?: string;
  aclPassword?: string;
  password?: string;
  connectTimeout: number;
  commandTimeout: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
}

export interface RedisClientInterface {
  client: Redis | Cluster;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  eval(script: string, keys: string[], args: string[]): Promise<any>;
  evalsha(sha: string, keys: string[], args: string[]): Promise<any>;
  scriptLoad(script: string): Promise<string>;
  time(): Promise<[string, string]>;
  ping(): Promise<string>;
}

export class RedisClient extends EventEmitter implements RedisClientInterface {
  public client: Redis | Cluster;
  private config: RedisConfig;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

  constructor(config: RedisConfig) {
    super();
    this.config = config;
    this.client = this.createClient();
    this.setupEventHandlers();
  }

  private createClient(): Redis | Cluster {
    const authConfig: any = {};
    
    // Prefer ACL authentication over legacy password
    if (this.config.aclUsername && this.config.aclPassword) {
      authConfig.username = this.config.aclUsername;
      authConfig.password = this.config.aclPassword;
    } else if (this.config.password) {
      authConfig.password = this.config.password;
    }

    if (this.config.cluster) {
      return new Redis.Cluster(this.config.cluster.nodes, {
        redisOptions: {
          ...authConfig,
          connectTimeout: this.config.connectTimeout,
          commandTimeout: this.config.commandTimeout,
          retryDelayOnFailover: this.config.retryDelayOnFailover,
          maxRetriesPerRequest: this.config.maxRetriesPerRequest,
          lazyConnect: this.config.lazyConnect,
        },
      });
    } else if (this.config.url) {
      return new Redis(this.config.url, {
        ...authConfig,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        retryDelayOnFailover: this.config.retryDelayOnFailover,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        lazyConnect: this.config.lazyConnect,
      });
    } else {
      throw new Error('Redis configuration must include either url or cluster nodes');
    }
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.connectionState = 'connected';
      this.emit('connect');
    });

    this.client.on('error', (error) => {
      this.connectionState = 'error';
      this.emit('error', error);
      this.emit('ratelimit.redis.disconnected', { error: error.message });
    });

    this.client.on('close', () => {
      this.connectionState = 'disconnected';
      this.emit('disconnect');
    });

    this.client.on('reconnecting', () => {
      this.connectionState = 'connecting';
      this.emit('reconnecting');
    });
  }

  async connect(): Promise<void> {
    if (this.connectionState === 'connected') return;
    
    this.connectionState = 'connecting';
    await this.client.connect();
    this.connectionState = 'connected';
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
    this.connectionState = 'disconnected';
  }

  isConnected(): boolean {
    return this.connectionState === 'connected' && this.client.status === 'ready';
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    return this.client.setex(key, seconds, value);
  }

  async eval(script: string, keys: string[], args: string[]): Promise<any> {
    return this.client.eval(script, keys.length, ...keys, ...args);
  }

  async evalsha(sha: string, keys: string[], args: string[]): Promise<any> {
    return this.client.evalsha(sha, keys.length, ...keys, ...args);
  }

  async scriptLoad(script: string): Promise<string> {
    const result = await this.client.script('LOAD', script);
    return result as string;
  }

  async time(): Promise<[string, string]> {
    const result = await this.client.time();
    if (Array.isArray(result) && result.length >= 2) {
      return [String(result[0]), String(result[1])];
    }
    throw new Error('Redis TIME command returned unexpected result');
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
} 