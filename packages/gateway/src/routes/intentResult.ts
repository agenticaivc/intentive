import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getExecutionStore } from '../store/executionStore';

const intentResultRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const store = getExecutionStore();

  fastify.get('/intent/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      querystring: {
        type: 'object',
        properties: {
          wait: { type: 'number', minimum: 0, maximum: 30000 } // Max 30s wait
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { wait } = request.query as { wait?: number };
    
    try {
      let record = await store.get(id);
      
      if (!record) {
        return reply.code(404).send({ error: 'Execution not found' });
      }
      
      if (record.archived) {
        return reply.code(410).send({ error: 'Execution archived' });
      }
      
      // Optional long-poll support
      if (wait && ['queued', 'running'].includes(record.status)) {
        const waitResult = await store.wait(id, wait);
        if (waitResult) {
          record = waitResult;
        }
      }
      
      return reply.code(200).send(record);
      
    } catch (error) {
      fastify.log.error({
        executionId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to retrieve execution record');
      
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};

export default intentResultRoute; 