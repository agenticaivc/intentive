export * from './RateLimitGuard';

// Auto-register the guard following verified GuardRegistry interface pattern
import { GuardRegistry } from '../GuardRegistry';
import { RateLimitGuard } from './RateLimitGuard';

// Register the rate limit guard so it can be instantiated by name
GuardRegistry.register('rate_limit', RateLimitGuard); 