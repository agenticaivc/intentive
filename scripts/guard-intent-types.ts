import { Project, SourceFile } from 'ts-morph';
import { join } from 'path';

interface InterfaceCheck {
  name: string;
  file: string;
  check: (sourceFile: SourceFile) => boolean;
}

// Find project root by looking for package.json with workspaces
function findProjectRoot(): string {
  let currentDir = process.cwd();
  while (currentDir !== '/') {
    try {
      const packagePath = join(currentDir, 'package.json');
      const pkg = require(packagePath);
      if (pkg.workspaces) {
        return currentDir;
      }
    } catch (e) {
      // Continue searching
    }
    currentDir = join(currentDir, '..');
  }
  return process.cwd(); // Fallback to current directory
}

const projectRoot = findProjectRoot();

const interfaceChecks: InterfaceCheck[] = [
  {
    name: 'IntentExecutionError class',
    file: join(projectRoot, 'packages/executor/src/graphql/GraphQLFallback.ts'),
    check: (sf) => sf.getClasses().some(c => c.getName() === 'IntentExecutionError')
  },
  {
    name: 'GraphQLFallback.execute method',
    file: join(projectRoot, 'packages/executor/src/graphql/GraphQLFallback.ts'),
    check: (sf) => {
      const gqlClass = sf.getClass('GraphQLFallback');
      return gqlClass?.getMethod('execute') !== undefined;
    }
  },
  {
    name: 'Executor class',
    file: join(projectRoot, 'packages/executor/src/Executor.ts'),
    check: (sf) => sf.getClasses().some(c => c.getName() === 'Executor')
  }
];

async function guardIntentTypes(): Promise<void> {
  console.log('🔍 Verifying intent executor interfaces with TS AST...');
  console.log(`📁 Project root: ${projectRoot}`);
  
  const project = new Project({
    tsConfigFilePath: join(projectRoot, 'tsconfig.json')
  });

  let allPassed = true;

  for (const check of interfaceChecks) {
    try {
      const sourceFile = project.getSourceFile(check.file);
      
      if (!sourceFile) {
        console.error(`❌ ${check.name}: File not found - ${check.file}`);
        allPassed = false;
        continue;
      }

      if (check.check(sourceFile)) {
        console.log(`✅ ${check.name}: Verified`);
      } else {
        console.error(`❌ ${check.name}: Interface not found in ${check.file}`);
        allPassed = false;
      }
    } catch (error) {
      console.error(`❌ ${check.name}: Error checking - ${error instanceof Error ? error.message : error}`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('🎯 All interface guards passed!');
  } else {
    console.error('💥 Interface guard failures detected');
    process.exit(1);
  }
}

guardIntentTypes().catch(console.error); 