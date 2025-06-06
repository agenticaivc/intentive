import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { intentBody, intentResponse } from '../schemas/intent';
import { intentListQuerySchema, intentListResponseSchema, IntentListQuery, IntentListResponse } from '../schemas/intentList';
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

  // POST /intent - Create new intent execution
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

  // GET /intent - List intent executions
  fastify.get('/intent', {
    schema: {
      querystring: intentListQuerySchema,
      response: {
        200: intentListResponseSchema
      }
    }
  }, async (request, reply) => {
    const query = request.query as IntentListQuery;
    
    try {
      // Parse status filter if provided
      const statusArray = query.status ? query.status.split(',') : undefined;
      
      // For MVP: determine user identity and admin status
      // TODO: Replace with proper JWT/auth middleware
      const requestingUserId = 'anonymous'; // Default user for MVP
      const isAdmin = false; // For MVP, no admin privileges
      
      // Security check: non-admin cannot filter by different user
      if (query.user && !isAdmin && query.user !== requestingUserId) {
        return reply.code(403).send({ 
          error: 'Forbidden',
          message: 'Cannot filter by different user without admin privileges'
        });
      }
      
      // Prepare list options
      const listOptions = {
        userId: query.user || requestingUserId,
        status: statusArray,
        limit: query.limit || 20,
        cursor: query.cursor,
        isAdmin
      };
      
      // Fetch execution records
      const result = await store.list(listOptions);
      
      // Convert dates to ISO strings for JSON response
      const response: IntentListResponse = {
        items: result.items.map(item => ({
          ...item,
          createdAt: item.createdAt.toISOString()
        })),
        nextCursor: result.nextCursor
      };
      
      return reply.code(200).send(response);
      
    } catch (error) {
      fastify.log.error({
        query,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to list intent executions');
      
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: 'Failed to retrieve intent list'
      });
    }
  });
};

export default intentRoute; 