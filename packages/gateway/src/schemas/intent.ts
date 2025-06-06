export const intentBody = {
  type: 'object',
  required: ['ask'],
  additionalProperties: false,
  properties: { 
    ask: { 
      type: 'string', 
      minLength: 1 
    } 
  }
} as const;

export const intentResponse = {
  202: {
    type: 'object',
    properties: { 
      executionId: { 
        type: 'string', 
        format: 'uuid' 
      },
      intent: {
        type: 'object',
        properties: {
          graphId: {
            type: 'string'
          },
          parameters: {
            type: 'object'
          }
        },
        required: ['graphId', 'parameters'],
        additionalProperties: false
      }
    },
    required: ['executionId'],
    additionalProperties: false
  }
} as const; 