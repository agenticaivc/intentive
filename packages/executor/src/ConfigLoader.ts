import { ExecutionConfig, ConcurrencyConfig, RetryConfig } from './types';

export interface LoadedConfig {
  timeout: number;
  retry: RetryConfig;
  concurrency: ConcurrencyConfig;
}

export class ConfigLoader {
  private static readonly DEFAULT_TIMEOUT = 300; // 5 minutes
  private static readonly DEFAULT_MAX_PARALLEL = 5;
  private static readonly DEFAULT_MAX_ATTEMPTS = 3;
  private static readonly DEFAULT_BACKOFF_MULTIPLIER = 2;

  /**
   * Load concurrency configuration from graph spec
   */
  static loadConcurrencyFromConfig(config?: ExecutionConfig): ConcurrencyConfig {
    if (!config?.concurrency) {
      return {
        maxParallel: this.DEFAULT_MAX_PARALLEL
      };
    }

    const maxParallel = config.concurrency.maxParallel;
    
    // Validate maxParallel
    if (typeof maxParallel !== 'number' || maxParallel < 1 || maxParallel > 100) {
      throw new Error(
        `Invalid maxParallel value: ${maxParallel}. Must be a number between 1 and 100.`
      );
    }

    return {
      maxParallel
    };
  }

  /**
   * Load retry configuration from graph spec
   */
  static loadRetryFromConfig(config?: ExecutionConfig): RetryConfig {
    if (!config?.retry) {
      return {
        maxAttempts: this.DEFAULT_MAX_ATTEMPTS,
        backoffMultiplier: this.DEFAULT_BACKOFF_MULTIPLIER
      };
    }

    const retry = config.retry;
    
    // Validate maxAttempts
    if (typeof retry.maxAttempts !== 'number' || retry.maxAttempts < 1 || retry.maxAttempts > 10) {
      throw new Error(
        `Invalid maxAttempts value: ${retry.maxAttempts}. Must be a number between 1 and 10.`
      );
    }

    // Validate backoffMultiplier
    if (typeof retry.backoffMultiplier !== 'number' || retry.backoffMultiplier < 1 || retry.backoffMultiplier > 10) {
      throw new Error(
        `Invalid backoffMultiplier value: ${retry.backoffMultiplier}. Must be a number between 1 and 10.`
      );
    }

    return {
      maxAttempts: retry.maxAttempts,
      backoffMultiplier: retry.backoffMultiplier,
      retry_on_errors: retry.retry_on_errors,
      no_retry_errors: retry.no_retry_errors
    };
  }

  /**
   * Load timeout configuration from graph spec
   */
  static loadTimeoutFromConfig(config?: ExecutionConfig): number {
    if (!config?.timeout) {
      return this.DEFAULT_TIMEOUT;
    }

    const timeout = config.timeout;
    
    // Validate timeout (1 second to 1 hour)
    if (typeof timeout !== 'number' || timeout < 1 || timeout > 3600) {
      throw new Error(
        `Invalid timeout value: ${timeout}. Must be a number between 1 and 3600 seconds.`
      );
    }

    return timeout;
  }

  /**
   * Load and validate complete execution configuration
   */
  static loadCompleteConfig(config?: ExecutionConfig): LoadedConfig {
    try {
      const concurrency = this.loadConcurrencyFromConfig(config);
      const retry = this.loadRetryFromConfig(config);
      const timeout = this.loadTimeoutFromConfig(config);

      return {
        timeout,
        retry,
        concurrency
      };
    } catch (error) {
      throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get configuration summary for logging
   */
  static getConfigSummary(config: LoadedConfig): string {
    return `ExecutionConfig: timeout=${config.timeout}s, maxParallel=${config.concurrency.maxParallel}, ` +
           `maxAttempts=${config.retry.maxAttempts}, backoffMultiplier=${config.retry.backoffMultiplier}`;
  }

  /**
   * Validate configuration against runtime constraints
   */
  static validateRuntimeConfig(config: LoadedConfig): void {
    // Additional runtime validations can be added here
    if (config.concurrency.maxParallel > 50) {
      console.warn(`High maxParallel value (${config.concurrency.maxParallel}) may cause resource exhaustion`);
    }

    if (config.timeout > 1800) { // 30 minutes
      console.warn(`Long timeout value (${config.timeout}s) may cause resource holding`);
    }
  }
} 