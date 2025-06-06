import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const loggerPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Logger is already configured at the Fastify instance level
  // This plugin can be used for additional logger setup if needed
  fastify.log.info('Logger plugin registered');
};

export default fp(loggerPlugin, {
  name: 'logger'
}); 