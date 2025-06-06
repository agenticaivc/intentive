import { describe, it, expect } from 'vitest';

// Mock intent parser function
function parseIntent(naturalLanguage: string, userContext: any): { graph_id: string; parameters: any } {
  // Simple pattern matching for payroll intents
  if (naturalLanguage.toLowerCase().includes('process payroll')) {
    const periodMatch = naturalLanguage.match(/(\w+\s+\d{4})/i);
    const period = periodMatch ? convertToYearMonth(periodMatch[1]) : '2024-12';
    
    return {
      graph_id: 'payroll-processing',
      parameters: {
        period,
        run_type: 'standard'
      }
    };
  }
  
  if (naturalLanguage.toLowerCase().includes('dry-run') && naturalLanguage.toLowerCase().includes('payroll')) {
    const periodMatch = naturalLanguage.match(/(\d{4}-\d{2})/);
    const period = periodMatch ? periodMatch[1] : '2024-12';
    
    return {
      graph_id: 'payroll-processing',
      parameters: {
        period,
        run_type: 'dry_run',
        dry_run: true
      }
    };
  }
  
  // Default fallback
  return {
    graph_id: 'unknown',
    parameters: {}
  };
}

function convertToYearMonth(dateString: string): string {
  // Convert "December 2024" to "2024-12"
  const monthMap: Record<string, string> = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12'
  };
  
  const parts = dateString.toLowerCase().split(' ');
  if (parts.length === 2) {
    const month = monthMap[parts[0]];
    const year = parts[1];
    if (month && year) {
      return `${year}-${month}`;
    }
  }
  
  return '2024-12'; // Default fallback
}

describe('NL-to-Intent parsing → payroll graph ID', () => {
  const mockUserContext = {
    id: 'finance_user_001',
    roles: ['finance_manager'],
    permissions: ['payroll:read', 'payroll:write']
  };

  it('maps "Process payroll for December 2024" to payroll-processing graph', async () => {
    const result = parseIntent('Process payroll for December 2024', mockUserContext);
    
    expect(result.graph_id).toBe('payroll-processing');
    expect(result.parameters.period).toBe('2024-12');
    expect(result.parameters.run_type).toBe('standard');
  });

  it('maps dry-run requests to payroll-processing with dry_run flag', async () => {
    const result = parseIntent('Re-run payroll dry-run for pay period 2024-12', mockUserContext);
    
    expect(result.graph_id).toBe('payroll-processing');
    expect(result.parameters.period).toBe('2024-12');
    expect(result.parameters.run_type).toBe('dry_run');
    expect(result.parameters.dry_run).toBe(true);
  });

  it('handles various date formats', () => {
    const testCases = [
      { input: 'Process payroll for January 2025', expected: '2025-01' },
      { input: 'Process payroll for March 2024', expected: '2024-03' },
      { input: 'Process payroll for November 2023', expected: '2023-11' }
    ];

    testCases.forEach(({ input, expected }) => {
      const result = parseIntent(input, mockUserContext);
      expect(result.parameters.period).toBe(expected);
    });
  });

  it('returns unknown graph for unrecognized intents', () => {
    const result = parseIntent('Send email to all employees', mockUserContext);
    
    expect(result.graph_id).toBe('unknown');
    expect(result.parameters).toEqual({});
  });

  it('validates intent parser function signature', () => {
    expect(typeof parseIntent).toBe('function');
    expect(parseIntent.length).toBe(2); // Should accept 2 parameters
  });

  it('validates parameter structure for payroll intents', () => {
    const result = parseIntent('Process payroll for December 2024', mockUserContext);
    
    // Check required parameters exist
    expect(result).toHaveProperty('graph_id');
    expect(result).toHaveProperty('parameters');
    expect(result.parameters).toHaveProperty('period');
    expect(result.parameters).toHaveProperty('run_type');
    
    // Validate parameter types
    expect(typeof result.graph_id).toBe('string');
    expect(typeof result.parameters.period).toBe('string');
    expect(typeof result.parameters.run_type).toBe('string');
  });
}); 