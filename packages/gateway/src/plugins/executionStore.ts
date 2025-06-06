import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { setExecutionStoreHook } from '@intentive/executor/dist/hooks/executionStoreHook';
import { GatewayExecutionStoreHook } from '../hooks/gatewayExecutionStoreHook';

const executionStorePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Initialize the gateway execution store hook
  const hook = new GatewayExecutionStoreHook();
  setExecutionStoreHook(hook);
  
  fastify.log.info('Execution store hook initialized');
};

export default fp(executionStorePlugin, {
  name: 'executionStore'
}); 