import { IntentCandidate, ParsedIntent, ParseOptions, parsedIntentSchema } from './types';

/**
 * Interface for intent parsers
 */
export interface IntentParser {
  parse(text: string, options?: ParseOptions): Promise<ParsedIntent>;
  readonly name: string;
  readonly version: string;
}

/**
 * Base abstract class for intent parsers with common functionality
 */
export abstract class BaseIntentParser implements IntentParser {
  abstract readonly name: string;
  abstract readonly version: string;
  
  abstract parse(text: string, options?: ParseOptions): Promise<ParsedIntent>;
  
  /**
   * Validates the parser result using Zod schema
   */
  protected validateResult(result: ParsedIntent): ParsedIntent {
    return parsedIntentSchema.parse(result);
  }
  
  /**
   * Sorts candidates by confidence in descending order
   */
  protected sortByConfidence(candidates: IntentCandidate[]): IntentCandidate[] {
    return [...candidates].sort((a, b) => b.confidence - a.confidence);
  }
} 