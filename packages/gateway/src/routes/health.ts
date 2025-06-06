import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const healthRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/health', {
    schema: {
      response: { 
        200: { 
          type: 'object', 
          properties: { 
            status: { 
              const: 'ok' 
            } 
          },
          required: ['status'],
          additionalProperties: false
        } 
      }
    }
  }, async (request, reply) => {
    reply.send({ status: 'ok' });
  });
};

export default healthRoute; 