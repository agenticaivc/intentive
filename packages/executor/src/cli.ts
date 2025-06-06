#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { Executor } from './Executor';
import { IntentGraph, ExecutionContext, NodeProperties } from './types';

interface Logger {
  info: (msg: string) => void;
  error: (msg: string) => void;
  warn: (msg: string) => void;
  log: (msg: string) => void;
}

interface CLIOptions {
  graphFile: string;
  failNode?: string;
  maxParallel?: number;
  verbose?: boolean;
}

// Extend NodeProperties to support failure injection
interface TestNodeProperties extends NodeProperties {
  injectFailure?: boolean;
}

class ExecutorCLI {
  private executor: Executor;

  constructor() {
    const logger: Logger = {
      info: (msg: string) => console.log(`[INFO] ${msg}`),
      error: (msg: string) => console.error(`[ERROR] ${msg}`),
      warn: (msg: string) => console.warn(`[WARN] ${msg}`),
      log: (msg: string) => console.log(`[LOG] ${msg}`)
    };

    this.executor = new Executor({
      logger: logger as any // Type assertion for now
    });
  }

  async run(options: CLIOptions): Promise<void> {
    try {
      // Load and parse graph file
      const graph = this.loadGraph(options.graphFile);
      
      // Override maxParallel if specified
      if (options.maxParallel) {
        graph.spec.config = graph.spec.config || {};
        graph.spec.config.concurrency = graph.spec.config.concurrency || { maxParallel: 5 };
        graph.spec.config.concurrency.maxParallel = options.maxParallel;
      }

      // Create execution context
      const context: ExecutionContext = {
        graphId: graph.metadata.name || 'cli-execution',
        executionId: `exec-${Date.now()}`,
        correlationId: `corr-${Date.now()}`,
        user: {
          id: 'cli-user',
          roles: ['admin'],
          permissions: ['*']
        },
        config: graph.spec.config
      };

      // Inject failure if requested
      if (options.failNode) {
        this.injectNodeFailure(graph, options.failNode);
      }

      console.log(`Starting execution of graph: ${graph.metadata.name}`);
      console.log(`Max parallel: ${graph.spec.config.concurrency?.maxParallel || 'default'}`);
      console.log(`Nodes: ${graph.spec.nodes.length}, Edges: ${graph.spec.edges.length}`);
      
      if (options.failNode) {
        console.log(`[TEST] Injected failure in node: ${options.failNode}`);
      }
      
      console.log('---');

      // Execute the graph
      const result = await this.executor.execute(graph, context);

      // Report results
      console.log('---');
      console.log('Execution Results:');
      console.log(`Success: ${result.success}`);
      console.log(`Duration: ${result.executionTime}ms`);
      console.log(`Completed nodes: ${result.completedNodes.length} - [${result.completedNodes.join(', ')}]`);
      console.log(`Failed nodes: ${result.failedNodes.length} - [${result.failedNodes.join(', ')}]`);
      console.log(`Skipped nodes: ${result.skippedNodes.length} - [${result.skippedNodes.join(', ')}]`);

      if (result.error) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      // Success case
      console.log('✅ Graph execution completed successfully');
      process.exit(0);

    } catch (error) {
      console.error(`CLI Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  }

  private loadGraph(filePath: string): IntentGraph {
    try {
      const absolutePath = path.resolve(filePath);
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      
      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        return yaml.parse(fileContent) as IntentGraph;
      } else if (filePath.endsWith('.json')) {
        return JSON.parse(fileContent) as IntentGraph;
      } else {
        throw new Error('Graph file must be YAML (.yaml/.yml) or JSON (.json)');
      }
    } catch (error) {
      throw new Error(`Failed to load graph file '${filePath}': ${error instanceof Error ? error.message : error}`);
    }
  }

  private injectNodeFailure(graph: IntentGraph, nodeId: string): void {
    const node = graph.spec.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node '${nodeId}' not found in graph`);
    }

    // Mark the node for failure by adding a special property
    (node.properties as TestNodeProperties).injectFailure = true;
    
    console.log(`[CLI] Injecting failure into node: ${nodeId}`);
  }
}

// Parse command line arguments
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Intentive Graph Executor CLI

Usage: node cli.js <graph-file> [options]

Arguments:
  <graph-file>      Path to the YAML or JSON graph file

Options:
  --failNode=<id>   Inject failure into specified node for testing
  --maxParallel=<n> Override maxParallel configuration (env: MAX_PARALLEL)
  --verbose         Enable verbose logging
  --help, -h        Show this help message

Environment Variables:
  MAX_PARALLEL      Override maxParallel configuration

Examples:
  node cli.js docs/examples/payroll-graph.yaml
  node cli.js docs/examples/payroll-graph.yaml --failNode=calculate_payroll
  MAX_PARALLEL=1 node cli.js docs/examples/payroll-graph.yaml
    `);
    process.exit(0);
  }

  const options: CLIOptions = {
    graphFile: args[0]
  };

  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--failNode=')) {
      options.failNode = arg.split('=')[1];
    } else if (arg.startsWith('--maxParallel=')) {
      options.maxParallel = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  // Check environment variables
  if (process.env.MAX_PARALLEL) {
    const envMaxParallel = parseInt(process.env.MAX_PARALLEL, 10);
    if (!isNaN(envMaxParallel)) {
      options.maxParallel = envMaxParallel;
    }
  }

  return options;
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    const cli = new ExecutorCLI();
    await cli.run(options);
  } catch (error) {
    console.error(`Fatal error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

// Export for testing
export { ExecutorCLI, CLIOptions };

// Run if called directly
if (require.main === module) {
  main();
} 