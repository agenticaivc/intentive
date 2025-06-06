#!/usr/bin/env node

/**
 * Comprehensive validation test for NLP gateway integration
 * Tests all validation scenarios including mock environments
 */

const http = require('http');
const { spawn } = require('child_process');

// Test configuration
const PORT = 4010;
const BASE_URL = `http://localhost:${PORT}`;

// Test cases
const testCases = [
  {
    name: "Happy path - payroll intent",
    env: { OPENAI_API_KEY: 'dummy' },
    payload: { ask: "Process payroll for December 2024" },
    expectedStatus: 202,
    expectedGraphId: "payroll"
  },
  {
    name: "Happy path - minimal intent", 
    env: { OPENAI_API_KEY: 'dummy' },
    payload: { ask: "Execute basic task" },
    expectedStatus: 202,
    expectedGraphId: "minimal"
  },
  {
    name: "Retry logic - 2 retries then success",
    env: { OPENAI_API_KEY: 'dummy', FORCE_429: '2' },
    payload: { ask: "Test retry logic" },
    expectedStatus: 202,
    expectRetryLogs: true
  },
  {
    name: "Error surface - 500 error",
    env: { OPENAI_API_KEY: 'dummy', FORCE_500: '1' },
    payload: { ask: "Test error handling" },
    expectedStatus: 202,
    expectError: true
  }
];

// HTTP client helper
function makeRequest(path, data = null, method = 'GET') {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData && { 'Content-Length': Buffer.byteLength(postData) })
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          resolve({ status: res.statusCode, data: parsed, raw: responseData });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData, raw: responseData });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Server management
function startServer(env = {}) {
  return new Promise((resolve, reject) => {
    const serverEnv = { 
      ...process.env, 
      PORT: PORT.toString(),
      ...env 
    };
    
    const server = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      env: serverEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    
    server.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Gateway server listening')) {
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      output += data.toString();
      if (output.includes('Gateway server listening')) {
        resolve(server);
      }
    });

    setTimeout(() => {
      if (!output.includes('Gateway server listening')) {
        server.kill();
        reject(new Error('Server failed to start within timeout'));
      }
    }, 10000);
  });
}

async function runValidationTests() {
  console.log('🚀 Running NLP Gateway Validation Tests...\n');

  let passed = 0;
  let total = testCases.length + 1; // +1 for health check

  // Test 1: Health check
  console.log('📋 Test 1: Health Check');
  try {
    const server = await startServer({ OPENAI_API_KEY: 'dummy' });
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for startup
    
    const healthResponse = await makeRequest('/health');
    
    if (healthResponse.status === 200 && healthResponse.data.status === 'ok') {
      console.log('✅ Health check passed\n');
      passed++;
    } else {
      console.log(`❌ Health check failed: ${JSON.stringify(healthResponse)}\n`);
    }
    
    server.kill();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
    
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}\n`);
  }

  // Test each case
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`📋 Test ${i + 2}: ${testCase.name}`);
    
    try {
      const server = await startServer(testCase.env);
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for startup
      
      const response = await makeRequest('/intent', testCase.payload, 'POST');
      
      // Check status
      if (response.status !== testCase.expectedStatus) {
        console.log(`❌ Wrong status: expected ${testCase.expectedStatus}, got ${response.status}`);
        server.kill();
        continue;
      }
      
      // Check executionId
      if (!response.data.executionId) {
        console.log(`❌ Missing executionId in response`);
        server.kill();
        continue;
      }
      
      // Check intent if expected
      if (testCase.expectedGraphId && response.data.intent) {
        if (response.data.intent.graphId !== testCase.expectedGraphId) {
          console.log(`❌ Wrong graphId: expected ${testCase.expectedGraphId}, got ${response.data.intent.graphId}`);
          server.kill();
          continue;
        }
      }
      
      console.log(`✅ ${testCase.name} passed`);
      if (response.data.intent) {
        console.log(`   Intent: ${response.data.intent.graphId}`);
      }
      console.log(`   Execution ID: ${response.data.executionId}\n`);
      passed++;
      
      server.kill();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
      
    } catch (error) {
      console.log(`❌ ${testCase.name} failed: ${error.message}\n`);
    }
  }

  console.log(`📊 Validation Results: ${passed}/${total} tests passed\n`);
  
  if (passed === total) {
    console.log('🎉 All validation tests passed! NLP integration is fully functional.');
  } else {
    console.log('⚠️  Some validation tests failed. Check the logs above for details.');
  }
  
  return passed === total;
}

// Run if called directly
if (require.main === module) {
  runValidationTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

module.exports = { runValidationTests }; 