import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { intentBody, intentResponse } from '../schemas/intent';
import { OpenAIClient } from '@intentive/nlp';
import { getExecutionStore } from '../store/executionStore';
import { ExecutionRecord } from '../models/ExecutionRecord';

const intentRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Lazy-load the NLP client to avoid module-level instantiation
  let nlpClient: OpenAIClient | null = null;
  const store = getExecutionStore();
  
  const getNlpClient = () => {
    if (!nlpClient) {
      nlpClient = new OpenAIClient();
    }
    return nlpClient;
  };

  fastify.post('/intent', {
    schema: { 
      body: intentBody, 
      response: intentResponse 
    }
  }, async (request, reply) => {
    const { ask } = request.body as { ask: string };
    const executionId = crypto.randomUUID();
    
    try {
      // Extract intent using NLP client
      const client = getNlpClient();
      const result = await client.extractIntent(ask);
      
      // Create initial execution record
      const record: ExecutionRecord = {
        id: executionId,
        createdAt: new Date(),
        status: 'queued',
        graphId: result.result.graphId,
        correlationId: crypto.randomUUID(),
        // Note: In production, extract user info from JWT/session
        userId: 'anonymous'
      };
      
      await store.upsert(record);
      
      // Log the successful intent extraction
      fastify.log.info({
        executionId,
        graphId: result.result.graphId,
        parameters: result.result.parameters,
        usage: result.usage,
        requestId: result.requestId
      }, 'Intent extracted successfully');
      
      // Return execution ID with extracted intent
      reply.code(202).send({ 
        executionId,
        intent: {
          graphId: result.result.graphId,
          parameters: result.result.parameters
        }
      });
      
    } catch (error) {
      // Log the error but still return 202 for now to maintain API contract
      fastify.log.error({
        executionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        ask
      }, 'Failed to extract intent');
      
      // Create failed execution record
      const record: ExecutionRecord = {
        id: executionId,
        createdAt: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to extract intent'
      };
      await store.upsert(record);
      
      // Return execution ID without intent on error
      reply.code(202).send({ executionId });
    }
  });
};

export default intentRoute; 