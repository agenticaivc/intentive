#!/usr/bin/env node
// Bridging script for dependabot compatibility during pnpm migration
// Delete this once all branches are pnpm-only

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔄 Generating package-lock.json for dependabot compatibility...');

try {
  // Only run if package-lock.json doesn't exist or is stale
  if (!fs.existsSync('package-lock.json')) {
    execSync('npm install --package-lock-only', { stdio: 'inherit' });
    console.log('✅ Generated fresh package-lock.json');
  } else {
    console.log('⏭️  Existing package-lock.json found, skipping');
  }
} catch (error) {
  console.error('❌ Failed to generate package-lock.json:', error.message);
  process.exit(1);
} 