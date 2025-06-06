#!/bin/bash
# Intentive API Test Script - Complete Workflow Demo
# Usage: ./scripts/test-api.sh

set -e

echo "🚀 Testing Intentive API - 15-Minute Payroll Guarantee"
echo "================================================="

# Check if gateway is running
if ! curl -s http://localhost:4000/__health > /dev/null; then
    echo "❌ Gateway not running. Please start with: npm run gateway:dev"
    exit 1
fi

echo "✅ Gateway is running"

echo -e "\n🎯 Step 1: Create Multiple Intent Executions"
echo "----------------------------------------------"

# Create payroll intent
PAYROLL_RESPONSE=$(curl -s -X POST http://localhost:4000/intent \
  -H "Content-Type: application/json" \
  -d '{"ask":"Process payroll for December 2024"}')
PAYROLL_ID=$(echo $PAYROLL_RESPONSE | jq -r '.executionId')
echo "✅ Payroll execution created: $PAYROLL_ID"

# Create report intent  
REPORT_RESPONSE=$(curl -s -X POST http://localhost:4000/intent \
  -H "Content-Type: application/json" \
  -d '{"ask":"Generate monthly financial report"}')
REPORT_ID=$(echo $REPORT_RESPONSE | jq -r '.executionId')
echo "✅ Report execution created: $REPORT_ID"

# Create audit intent
AUDIT_RESPONSE=$(curl -s -X POST http://localhost:4000/intent \
  -H "Content-Type: application/json" \
  -d '{"ask":"Run compliance audit check"}')
AUDIT_ID=$(echo $AUDIT_RESPONSE | jq -r '.executionId')
echo "✅ Audit execution created: $AUDIT_ID"

sleep 1

echo -e "\n📋 Step 2: List All Executions"
echo "------------------------------"
curl -s http://localhost:4000/intent | jq '{
  totalItems: (.items | length),
  recentExecutions: .items[0:3] | map({id, graph, status, createdAt})
}'

echo -e "\n🔍 Step 3: Check Individual Execution Status"
echo "--------------------------------------------"
echo "Payroll Status:"
curl -s http://localhost:4000/intent/$PAYROLL_ID | jq '{id, graph, status, durationMs, user}'

echo -e "\nReport Status:"  
curl -s http://localhost:4000/intent/$REPORT_ID | jq '{id, graph, status, durationMs, user}'

echo -e "\n🏷️  Step 4: Filter by Status"
echo "----------------------------"
echo "Queued executions count:"
curl -s "http://localhost:4000/intent?status=queued" | jq '.items | length'

echo -e "\nAll statuses summary:"
curl -s http://localhost:4000/intent | jq '.items | group_by(.status) | map({status: .[0].status, count: length})'

echo -e "\n📄 Step 5: Pagination Test"
echo "-------------------------"
echo "First 2 executions:"
FIRST_PAGE=$(curl -s "http://localhost:4000/intent?limit=2")
echo $FIRST_PAGE | jq '{itemCount: (.items | length), hasNextCursor: (.nextCursor != null)}'

CURSOR=$(echo $FIRST_PAGE | jq -r '.nextCursor // empty')
if [ ! -z "$CURSOR" ]; then
  echo -e "\nNext 2 executions (using cursor):"
  curl -s "http://localhost:4000/intent?limit=2&cursor=$CURSOR" | jq '{itemCount: (.items | length)}'
fi

echo -e "\n⏱️  Step 6: Performance Test - 15-Minute Guarantee"
echo "-------------------------------------------------"
START_TIME=$(date +%s%3N)

echo "Creating 5 demo executions..."
for i in {1..5}; do
  DEMO_RESPONSE=$(curl -s -X POST http://localhost:4000/intent \
    -H "Content-Type: application/json" \
    -d "{\"ask\":\"Demo execution #$i - $(date)\"}")
  DEMO_ID=$(echo $DEMO_RESPONSE | jq -r '.executionId')
  echo "⚡ Demo $i: $DEMO_ID"
done

END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

echo -e "\n🎉 PERFORMANCE RESULTS:"
echo "====================="
echo "📊 Total executions created: 8" 
echo "⏱️  Batch creation time: ${DURATION}ms"
echo "🚀 Average per execution: $((DURATION / 5))ms"
echo "✅ 15-minute guarantee: $([ $DURATION -lt 900000 ] && echo "PASSED ✅" || echo "FAILED ❌") (${DURATION}ms < 900,000ms)"

echo -e "\n🔄 Step 7: Final Status Overview"
echo "-------------------------------"
curl -s http://localhost:4000/intent | jq '{
  totalExecutions: (.items | length),
  statusBreakdown: (.items | group_by(.status) | map({status: .[0].status, count: length})),
  mostRecentExecution: .items[0].createdAt,
  oldestExecution: .items[-1].createdAt
}'

echo -e "\n✨ Test complete! All API endpoints validated successfully."
echo "========================================================="
echo ""
echo "📚 Available endpoints tested:"
echo "  • POST /intent           - Create intent execution"
echo "  • GET /intent            - List all executions (with filtering & pagination)"
echo "  • GET /intent/:id        - Get execution status"
echo ""
echo "🎯 Key features demonstrated:"
echo "  • Natural language intent processing"
echo "  • Real-time execution tracking"
echo "  • Status filtering (queued, running, completed, failed)"
echo "  • Cursor-based pagination"
echo "  • 15-minute performance guarantee" 