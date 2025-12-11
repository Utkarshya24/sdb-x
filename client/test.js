/**
 * Quick Test File for SandboxSDK
 * 
 * Usage:
 * 1. Start server: npm run server
 * 2. Run tests: npx ts-node test-quick.ts
 */

import SandboxSDK from '../sdk/dist/esm/index.js';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(level, message) {
  const timestamp = new Date().toLocaleTimeString();
  const emoji =
    level === 'success' ? '✅' :
    level === 'error' ? '❌' :
    level === 'info' ? 'ℹ️' :
    level === 'test' ? '🧪' :
    '▶️';

  const color =
    level === 'success' ? colors.green :
    level === 'error' ? colors.red :
    level === 'info' ? colors.blue :
    level === 'test' ? colors.cyan :
    colors.yellow;

  console.log(`${color}${emoji} [${timestamp}] ${message}${colors.reset}`);
}

async function runTests() {
  let passedTests = 0;
  let failedTests = 0;

  const sdk = new SandboxSDK({
    apiKey: 'sk_test_your_api_key_here',
    serverUrl: 'http://localhost:3000',
    enableLogging: false, // Disable SDK logging for cleaner output
    enableMetrics: true,
  });

  try {
    // ============ Test 1: Connection ============
    log('test', '1️⃣ Test: Connection');
    try {
      await sdk.waitForConnection(5000);
      log('success', 'Connected to server');
      passedTests++;
    } catch (error) {
      log('error', `Connection failed: ${error}`);
      failedTests++;
      return; // Exit if can't connect
    }

    // ============ Test 2: Get Templates ============
    log('test', '2️⃣ Test: Get Templates');
    try {
      const templates = await sdk.getTemplates();
      if (templates.templates.length > 0) {
        log('success', `Found ${templates.templates.length} templates`);
        templates.templates.forEach((t) => {
          console.log(`   - ${t.config.name} (${t.id})`);
        });
        passedTests++;
      } else {
        log('error', 'No templates found');
        failedTests++;
      }
    } catch (error) {
      log('error', `Get templates failed: ${error}`);
      failedTests++;
    }

    // ============ Test 3: Create Sandbox ============
    log('test', '3️⃣ Test: Create Sandbox');
    let sandboxId = '';
    try {
      const { sandbox } = await sdk.createSandbox({
        templateId: 'python-3-11',
        name: 'Test Sandbox',
      });
      sandboxId = sandbox.id;
      log('success', `Sandbox created: ${sandboxId}`);
      console.log(`   - Status: ${sandbox.status}`);
      console.log(`   - Template: ${sandbox.templateId}`);
      passedTests++;
    } catch (error) {
      log('error', `Create sandbox failed: ${error}`);
      failedTests++;
    }

    if (!sandboxId) {
      log('error', 'Cannot continue without sandbox');
      return;
    }

    // ============ Test 4: List Sandboxes ============
    log('test', '4️⃣ Test: List Sandboxes');
    try {
      const sandboxes = await sdk.listSandboxes();
      if (sandboxes.length > 0) {
        log('success', `Found ${sandboxes.length} sandbox(es)`);
        passedTests++;
      } else {
        log('error', 'No sandboxes found');
        failedTests++;
      }
    } catch (error) {
      log('error', `List sandboxes failed: ${error}`);
      failedTests++;
    }

    // ============ Test 5: Run Code (Python) ============
    log('test', '5️⃣ Test: Run Python Code');
    try {
      const result = await sdk.runCode(
        sandboxId,
        `print("Hello from SDK!")
x = 10 + 20
print(f"Result: {x}")`,
        {
          onStdout: (output) => {
            console.log(`   stdout: ${output.line}`);
          },
          onStderr: (output) => {
            console.log(`   stderr: ${output.line}`);
          },
        }
      );

      if (result.execution.logs.stdout.length > 0) {
        log('success', `Code executed successfully`);
        passedTests++;
      } else {
        log('error', 'No output from code execution');
        failedTests++;
      }
    } catch (error) {
      log('error', `Run code failed: ${error}`);
      failedTests++;
    }

    // ============ Test 6: Write File ============
    log('test', '6️⃣ Test: Write File');
    try {
      await sdk.writeFile(
        {
          sandboxId,
          path: '/workspace/test.py',
        },
        'print("File content")'
      );
      log('success', 'File written successfully');
      passedTests++;
    } catch (error) {
      log('error', `Write file failed: ${error}`);
      failedTests++;
    }

    // ============ Test 7: Read File ============
    log('test', '7️⃣ Test: Read File');
    try {
      const content = await sdk.readFile({
        sandboxId,
        path: '/workspace/test.py',
      });
      log('success', `File read successfully`);
      console.log(`   Content: ${content}`);
      passedTests++;
    } catch (error) {
      log('error', `Read file failed: ${error}`);
      failedTests++;
    }

    // ============ Test 8: List Files ============
    log('test', '8️⃣ Test: List Files');
    try {
      const files = await sdk.listFiles(sandboxId);
      if (files.files.length > 0) {
        log('success', `Found ${files.files.length} file(s)`);
        files.files.forEach((f) => {
          console.log(`   - ${f.path} (${f.size} bytes)`);
        });
        passedTests++;
      } else {
        log('error', 'No files found');
        failedTests++;
      }
    } catch (error) {
      log('error', `List files failed: ${error}`);
      failedTests++;
    }

    // ============ Test 9: Create Context ============
    log('test', '9️⃣ Test: Create Context');
    let contextId = '';
    try {
      const context = await sdk.createCodeContext({
        sandboxId,
        language: 'python',
      });
      contextId = context.id;
      log('success', `Context created: ${contextId}`);
      passedTests++;
    } catch (error) {
      log('error', `Create context failed: ${error}`);
      failedTests++;
    }

    // ============ Test 10: Delete Context ============
    if (contextId) {
      log('test', '🔟 Test: Delete Context');
      try {
        await sdk.deleteCodeContext(contextId);
        log('success', 'Context deleted successfully');
        passedTests++;
      } catch (error) {
        log('error', `Delete context failed: ${error}`);
        failedTests++;
      }
    }

    // ============ Test 11: Terminal Command ============
    log('test', '1️⃣1️⃣ Test: Terminal Command');
    try {
      const output = await sdk.runTerminal(sandboxId, 'ls -la', {
        onStdout: (output) => {
          console.log(`   ${output.line}`);
        },
      });
      log('success', 'Terminal command executed');
      passedTests++;
    } catch (error) {
      log('error', `Terminal command failed: ${error}`);
      failedTests++;
    }

    // ============ Test 12: Metrics ============
    log('test', '1️⃣2️⃣ Test: Metrics');
    try {
      const metrics = sdk.getMetrics();
      log('success', 'Metrics retrieved');
      console.log(`   Total Requests: ${metrics.totalRequests}`);
      console.log(`   Successful: ${metrics.successfulRequests}`);
      console.log(`   Failed: ${metrics.failedRequests}`);
      console.log(`   Avg Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`);
      passedTests++;
    } catch (error) {
      log('error', `Get metrics failed: ${error}`);
      failedTests++;
    }

    // ============ Test 13: Delete Sandbox ============
    log('test', '1️⃣3️⃣ Test: Delete Sandbox');
    try {
      await sdk.deleteSandbox(sandboxId);
      log('success', 'Sandbox deleted successfully');
      passedTests++;
    } catch (error) {
      log('error', `Delete sandbox failed: ${error}`);
      failedTests++;
    }

    // ============ Summary ============
    console.log('\n' + '='.repeat(50));
    log('info', `📊 Test Summary`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
    console.log('='.repeat(50));

    if (failedTests === 0) {
      log('success', '🎉 All tests passed!');
    } else {
      log('error', `⚠️ ${failedTests} test(s) failed`);
    }
  } catch (error) {
    log('error', `Unexpected error: ${error}`);
  } finally {
    sdk.disconnect();
    log('info', 'SDK disconnected');
  }
}

// Run tests
console.log(`\n${'='.repeat(50)}`);
console.log('🧪 SandboxSDK Test Suite');
console.log(`${'='.repeat(50)}\n`);

runTests().catch(console.error);