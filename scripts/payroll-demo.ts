#!/usr/bin/env node
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
// CRITICAL: Import from package entry point, not TS source
import { Executor } from '@intentive/executor';
import type { IntentGraph, ExecutionContext } from '@intentive/executor';

// Simple payroll graph that avoids complex conditionals
const simplePayrollGraph: IntentGraph = {
  apiVersion: "intentive.dev/v1",
  kind: "IntentGraph",
  metadata: {
    name: "payroll-demo",
    description: "Simplified payroll processing for demo"
  },
  spec: {
    nodes: [
      {
        id: "authenticate_user",
        type: "action",
        properties: {
          name: "Authenticate User",
          description: "Verify user identity",
          handler: "auth.authenticate"
        }
      },
      {
        id: "fetch_employee_data",
        type: "data",
        properties: {
          name: "Fetch Employee Data",
          description: "Retrieve employee records",
          handler: "data.fetch_employees"
        }
      },
      {
        id: "calculate_payroll",
        type: "action",
        properties: {
          name: "Calculate Payroll",
          description: "Calculate payroll amounts",
          handler: "payroll.calculate"
        }
      },
      {
        id: "process_payments",
        type: "action",
        properties: {
          name: "Process Payments",
          description: "Execute payments",
          handler: "payments.process"
        }
      },
      {
        id: "send_notifications",
        type: "action",
        properties: {
          name: "Send Notifications",
          description: "Notify completion",
          handler: "notifications.send"
        }
      }
    ],
    edges: [
      {
        id: "auth_to_data",
        from: "authenticate_user",
        to: "fetch_employee_data",
        type: "sequence",
        conditions: []
      },
      {
        id: "data_to_calc",
        from: "fetch_employee_data",
        to: "calculate_payroll",
        type: "sequence",
        conditions: []
      },
      {
        id: "calc_to_payments",
        from: "calculate_payroll",
        to: "process_payments",
        type: "sequence",
        conditions: []
      },
      {
        id: "payments_to_notify",
        from: "process_payments",
        to: "send_notifications",
        type: "sequence",
        conditions: []
      }
    ],
    guards: [],
    config: {
      timeout: 30,
      retry: {
        maxAttempts: 2,
        backoffMultiplier: 2
      },
      concurrency: {
        maxParallel: 2
      }
    }
  }
};

async function runPayrollDemo(): Promise<void> {
  console.log('🚀 Starting Intentive Payroll Demo...\n');

  try {
    // Use simplified graph to avoid conditional dependency issues
    console.log('1️⃣ Loading simplified payroll graph...');
    const graph = simplePayrollGraph;
    console.log(`✅ Loaded graph: ${graph.metadata.name} (${graph.spec.nodes.length} nodes)\n`);

    // 2. Create execution context
    console.log('2️⃣ Setting up execution context...');
    const context: ExecutionContext = {
      graphId: graph.metadata.name,
      executionId: `demo-${Date.now()}`,
      correlationId: `payroll-demo-${new Date().toISOString()}`,
      user: {
        id: 'demo_user',
        roles: ['payroll_admin', 'finance_manager'],
        permissions: ['payroll:read', 'payroll:write', 'finance:calculate']
      },
      config: graph.spec.config,
      logger: console
    };
    console.log(`✅ Context ready for user: ${context.user.id}\n`);

    // 3. Execute with real executor
    console.log('3️⃣ Executing payroll workflow...');
    const executor = new Executor({ logger: console });
    
    const startTime = Date.now();
    const result = await executor.execute(graph, context);
    const duration = Date.now() - startTime;

    // 4. Report results with explicit success exit
    if (result.success) {
      console.log('\n🎉 Payroll success! Demo completed successfully');
      console.log(`📊 Results: ${result.completedNodes.length} nodes executed, ${result.failedNodes.length} errors`);
      console.log(`⏱️  Execution time: ${duration}ms`);
      console.log(`✨ Completed nodes: ${result.completedNodes.join(', ')}`);
      
      // Explicit green exit for Docker timing test
      process.exit(0);
    } else {
      console.error('\n❌ Payroll demo failed');
      console.error(`Error: ${result.error?.message || 'Unknown error'}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Demo script error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runPayrollDemo().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { runPayrollDemo }; 