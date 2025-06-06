import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getExecutionStore } from '../store/executionStore';
import { intentListQuerySchema, intentListResponseSchema, IntentListQuery, IntentListResponse } from '../schemas/intentList';

const intentListRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const store = getExecutionStore();

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

export default intentListRoute; 