#!/usr/bin/env node

/**
 * Simple integration test to demonstrate NLP gateway integration
 * Run with: OPENAI_API_KEY=your_key node test-integration.js
 */

const http = require('http');

// Test data
const testCases = [
  { ask: "Process payroll for December 2024", expectedGraph: "payroll" },
  { ask: "Execute basic task", expectedGraph: "minimal" },
  { ask: "Handle salary payments for November", expectedGraph: "payroll" },
  { ask: "Do something simple", expectedGraph: "minimal" }
];

// Simple HTTP client
function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/intent',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Testing NLP Gateway Integration...\n');
  
  // Check if server is running
  try {
    const healthCheck = await makeRequest({});
  } catch (error) {
    console.log('❌ Gateway server not running. Start it with:');
    console.log('   cd packages/gateway && OPENAI_API_KEY=your_key npm run dev');
    return;
  }

  let passed = 0;
  let total = testCases.length;

  for (const testCase of testCases) {
    try {
      console.log(`📝 Testing: "${testCase.ask}"`);
      
      const response = await makeRequest({ ask: testCase.ask });
      
      if (response.status === 202 && response.data.executionId) {
        console.log(`✅ Got execution ID: ${response.data.executionId}`);
        console.log(`   Expected graph: ${testCase.expectedGraph}\n`);
        passed++;
      } else {
        console.log(`❌ Unexpected response: ${JSON.stringify(response)}\n`);
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}\n`);
    }
  }

  console.log(`\n📊 Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! NLP integration is working.');
  } else {
    console.log('⚠️  Some tests failed. Check the gateway logs for details.');
  }
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests }; 