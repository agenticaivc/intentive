#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Interface validation script for guards
console.log('🔍 Checking Guard interface compliance...');

const REQUIRED_METHODS = ['init', 'validate', 'execute', 'cleanup'];
const REQUIRED_PROPERTIES = ['name', 'type'];

function checkGuardFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for class that implements Guard
    const classMatch = content.match(/class\s+(\w+Guard)\s+implements\s+Guard/);
    if (!classMatch) {
      return { valid: false, error: 'No Guard implementation found' };
    }
    
    const className = classMatch[1];
    console.log(`  📝 Checking ${className}...`);
    
    // Check required properties
    for (const prop of REQUIRED_PROPERTIES) {
      const propRegex = new RegExp(`readonly\\s+${prop}\\s*[=:]`);
      if (!propRegex.test(content)) {
        return { valid: false, error: `Missing property: ${prop}` };
      }
    }
    
    // Check required methods
    for (const method of REQUIRED_METHODS) {
      const methodRegex = new RegExp(`async\\s+${method}\\s*\\(`);
      if (!methodRegex.test(content)) {
        return { valid: false, error: `Missing method: ${method}` };
      }
    }
    
    return { valid: true, className };
    
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function main() {
  const guardsDir = path.join(__dirname, '../packages/guards/src');
  
  if (!fs.existsSync(guardsDir)) {
    console.error('❌ Guards directory not found');
    process.exit(1);
  }
  
  let totalChecked = 0;
  let validGuards = 0;
  const errors = [];
  
  // Check all guard files
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (file.endsWith('Guard.ts')) {
        totalChecked++;
        const result = checkGuardFile(fullPath);
        
        if (result.valid) {
          validGuards++;
          console.log(`  ✅ ${result.className} - Interface compliant`);
        } else {
          errors.push({ file, error: result.error });
          console.log(`  ❌ ${file} - ${result.error}`);
        }
      }
    }
  }
  
  scanDirectory(guardsDir);
  
  console.log('\n📊 Interface Validation Summary:');
  console.log(`  Total Guards Checked: ${totalChecked}`);
  console.log(`  Valid Guards: ${validGuards}`);
  console.log(`  Failed Guards: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Interface Validation Failed');
    errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All Guards pass interface validation');
    process.exit(0);
  }
}

main(); 