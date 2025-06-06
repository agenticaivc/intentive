// GraphQL fallback logging utility
// Follows Drew Barrymore Protocol: Structured, testable, unified debug prints

import debug from 'debug';

export const log = debug('fallback');

// Structured logging helpers for consistent format
export function logQuery(nodeId: string, query: string, variables?: Record<string, any>): void {
  log('Query for node %s: %s', nodeId, query.replace(/\s+/g, ' ').trim());
  if (variables && Object.keys(variables).length > 0) {
    log('Variables: %o', variables);
  }
}

export function logResponse(nodeId: string, executionTime: number, success: boolean): void {
  log('Response for node %s: %dms, success=%s', nodeId, executionTime, success);
}

export function logError(nodeId: string, error: Error): void {
  log('Error for node %s: %s', nodeId, error.message);
}

export function logFallbackSkipped(nodeId: string, reason: string): void {
  log('Fallback skipped for node %s: %s', nodeId, reason);
} 