import { createHash } from 'crypto';
import { BaseIntentParser } from './IntentParser';
import { IntentCandidate, ParsedIntent, ParseOptions, ParserError } from './types';
import { OpenAIClient } from './openaiClient';
import { NlpError } from './errors';

/**
 * Enhanced OpenAI intent parser with confidence scoring and multiple candidates
 */
export class OpenAIIntentParser extends BaseIntentParser {
  readonly name = 'openai-intent-parser';
  readonly version = '0.1.0';
  
  constructor(
    private client: OpenAIClient,
    private availableGraphIds: string[] = []
  ) {
    super();
  }
  
  async parse(text: string, options: ParseOptions = {}): Promise<ParsedIntent> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Use the existing extractIntent method with proper interface verification
        const result = await this.client.extractIntent(text, {
          temperature: options.modelOverride ? undefined : 0.3,
          maxTokens: 150
        });
        
        // Convert single result to multiple candidates format
        const candidates = this.convertToMultipleCandidates(result.result, text);
        const sortedCandidates = this.sortByConfidence(candidates);
        
        const maxAlternatives = options.maxAlternatives || 3;
        const primary = sortedCandidates[0];
        const alternatives = sortedCandidates.slice(1, maxAlternatives + 1);
        
        const parsedResult: ParsedIntent = {
          primary,
          alternatives,
          raw: text,
          timestamp: new Date()
        };
        
        return this.validateResult(parsedResult);
      } catch (error) {
        lastError = error as Error;
        
        // Handle NlpError rate limiting
        if (error instanceof NlpError && error.type === 'RATE_LIMIT') {
          if (attempt < 3) {
            const delay = Math.pow(2, attempt) * 1000;
            await this.sleep(delay);
            continue;
          }
        }
        
        // Don't retry for other errors
        break;
      }
    }
    
    throw new ParserError(`Failed to parse intent after 3 attempts: ${lastError?.message || 'Unknown error'}`, lastError || undefined);
  }
  
  /**
   * Convert single IntentResult to multiple candidates with confidence scoring
   * This is a placeholder implementation - in production, you'd want to modify
   * the OpenAI prompt to return multiple candidates with confidence scores
   */
  private convertToMultipleCandidates(result: any, originalText: string): IntentCandidate[] {
    // For now, create a single candidate with estimated confidence
    const baseConfidence = this.estimateConfidence(result.graphId, originalText);
    
    const candidates: IntentCandidate[] = [{
      graphId: result.graphId,
      parameters: result.parameters || {},
      confidence: baseConfidence
    }];
    
    // Add some alternative candidates with lower confidence for demo
    // In production, this would come from the OpenAI response
    if (this.availableGraphIds.length > 1) {
      const alternatives = this.availableGraphIds
        .filter(id => id !== result.graphId)
        .slice(0, 2)
        .map((graphId, index) => ({
          graphId,
          parameters: {},
          confidence: Math.max(0.1, baseConfidence - 0.2 - (index * 0.1))
        }));
      
      candidates.push(...alternatives);
    }
    
    return candidates;
  }
  
  /**
   * Estimate confidence based on graph ID match and text analysis
   */
  private estimateConfidence(graphId: string, text: string): number {
    const lowerText = text.toLowerCase();
    const lowerGraphId = graphId.toLowerCase();
    
    // Simple heuristic - in production, use the confidence from OpenAI
    if (lowerText.includes(lowerGraphId)) {
      return 0.9;
    }
    
    // Check for keyword matches
    const keywords = lowerGraphId.split('-');
    const matches = keywords.filter(keyword => lowerText.includes(keyword));
    
    if (matches.length > 0) {
      return Math.min(0.8, 0.5 + (matches.length / keywords.length) * 0.3);
    }
    
    return 0.6; // Default confidence
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 