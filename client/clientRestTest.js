import SandboxSDK from "../sdk/dist/esm/agent.js";

// ============ Client Example - User only calls SDK functions ============

async function main() {
  console.log("╔════════════════════════════════════╗");
  console.log("║  🚀 Sandbox SDK Client             ║");
  console.log("╚════════════════════════════════════╝\n");

  const results = [];

  async function runTest(testName, testFn) {
    const startTime = Date.now();
    try {
      await testFn();
      const duration = Date.now() - startTime;
      results.push({ name: testName, status: "PASS", duration });
      console.log(`✅ ${testName} (${duration}ms)\n`);
    } catch (error) {
      const duration = Date.now() - startTime;
      results.push({ name: testName, status: "FAIL", duration, error: String(error) });
      console.error(`❌ ${testName}\n   Error: ${String(error)}\n`);
    }
  }

  // ============ User Registration ============
  console.log("📝 User Registration\n");
  
  let userApiKey = "";

  await runTest("Register User", async () => {
    const response = await fetch("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `user-${Date.now()}`,
        email: `user-${Date.now()}@example.com`,
      }),
    });

    const data = await response.json();
    userApiKey = data.apiKey;
    console.log(`   User ID: ${data.userId}`);
    console.log(`   API Key: ${data.apiKey.substring(0, 20)}...`);
  });

  // ============ Initialize SDK ============
  console.log("🔧 SDK Initialization\n");

  const sdk = new SandboxSDK({
    apiKey: userApiKey,
    serverUrl: "http://localhost:3000",
    enableLogging: false,
  });

  console.log(`✅ SDK Ready\n`);

  let templateId = "";
  let sandboxId = "";
  let contextId = "";

  // ============ Template Management ============
  console.log("📋 Template Management\n");

  await runTest("Create Template", async () => {
    const template = await sdk.createTemplate({
      name: "Python 3.9",
      language: "python",
      version: "3.9",
      dockerImage: "python:3.9",
      dependencies: ["requests"],
    });
    templateId = template.id;
    console.log(`   Template ID: ${template.id}`);
  });

  await runTest("Get Template Details", async () => {
    const template = await sdk.getTemplate(templateId);
    console.log(`   Name: ${template.config.name}`);
    console.log(`   Language: ${template.config.language}`);
  });

  await runTest("List All Templates", async () => {
    const list = await sdk.getTemplates(1, 10);
    console.log(`   Total Templates: ${list.total}`);
    console.log(`   Current Page: ${list.page}`);
  });

  // ============ Sandbox Management ============
  console.log("\n🏠 Sandbox Management\n");

  await runTest("Create Sandbox", async () => {
    const response = await sdk.createSandbox({
      templateId: templateId,
      name: "My Development Sandbox",
      autoStart: true,
      initialEnvVars: {
        MY_ENV: "production",
      },
    });
    sandboxId = response.sandbox.id;
    console.log(`   Sandbox ID: ${response.sandbox.id}`);
    console.log(`   Status: ${response.sandbox.status}`);
  });

  await runTest("Check Sandbox Status", async () => {
    const status = await sdk.getSandboxStatus(sandboxId);
    console.log(`   Current Status: ${status}`);
  });

  await runTest("List My Sandboxes", async () => {
    const list = await sdk.listSandboxes();
    console.log(`   Total Sandboxes: ${list.length}`);
  });

  // ============ Code Execution ============
  console.log("\n⚙️  Code Execution\n");

  await runTest("Execute Python Code", async () => {
    const result = await sdk.runCode(
      sandboxId,
      `
def greet(name):
    return f"Hello, {name}!"

result = greet("World")
print(result)
print("Math: 10 + 5 =", 10 + 5)
      `,
      {
        onResult: (r) => {
          if (r.text) console.log(`   Output: ${r.text}`);
        },
      }
    );
    console.log(`   Execution Time: ${result.metadata.duration}ms`);
  });

  await runTest("Run Terminal Command", async () => {
    const output = await sdk.runTerminal(sandboxId, "echo 'System is running'", {
      onStdout: (o) => {
        console.log(`   Command Output: ${o.line}`);
      },
    });
  });

  // ============ File Operations ============
  console.log("\n📁 File Operations\n");

  await runTest("Write File", async () => {
    const result = await sdk.writeFile(
      {
        sandboxId: sandboxId,
        path: "/tmp/mydata.txt",
        createParents: true,
      },
      "This is my important data!"
    );
    console.log(`   File created at: ${result}`);
  });

  await runTest("Read File", async () => {
    const content = await sdk.readFile({
      sandboxId: sandboxId,
      path: "/tmp/mydata.txt",
    });
    console.log(`   File Content: "${content}"`);
  });

  await runTest("List Files", async () => {
    const result = await sdk.listFiles(sandboxId, "/tmp");
    console.log(`   Files in /tmp: ${result.files.length}`);
    result.files.forEach((f) => {
      console.log(`     - ${f.path} (${f.size} bytes)`);
    });
  });

  await runTest("Delete File", async () => {
    await sdk.deleteFile({
      sandboxId: sandboxId,
      path: "/tmp/mydata.txt",
    });
    console.log(`   File deleted successfully`);
  });

  // ============ Code Context ============
  console.log("\n🎯 Code Context Management\n");

  await runTest("Create Code Context", async () => {
    const ctx = await sdk.createCodeContext({
      sandboxId: sandboxId,
      language: "python",
      cwd: "/workspace",
    });
    contextId = ctx.id;
    console.log(`   Context ID: ${ctx.id}`);
    console.log(`   Working Dir: ${ctx.cwd}`);
  });

  await runTest("List Contexts", async () => {
    const list = await sdk.listCodeContexts(sandboxId);
    console.log(`   Total Contexts: ${list.length}`);
  });

  await runTest("Delete Context", async () => {
    await sdk.deleteCodeContext(contextId);
    console.log(`   Context removed`);
  });

  // ============ Batch Operations ============
  console.log("\n📦 Batch Operations\n");

  await runTest("Execute Batch Jobs", async () => {
    const results = await sdk.executeBatch(sandboxId, [
      {
        id: "job-1",
        code: 'print("Processing Job 1")',
        timeout: 5000,
      },
      {
        id: "job-2",
        code: 'print("Processing Job 2")',
        timeout: 5000,
      },
      {
        id: "job-3",
        code: 'print("Processing Job 3")',
        timeout: 5000,
      },
    ]);
    console.log(`   Executed ${results.length} jobs`);
    results.forEach((r) => {
      console.log(`     - Job ${r.jobId}: ${r.success ? "✅ Success" : "❌ Failed"}`);
    });
  });

  // ============ Metrics ============
  console.log("\n📊 SDK Metrics\n");

  await runTest("Get Metrics", async () => {
    const metrics = sdk.getMetrics();
    console.log(`   Total Requests: ${metrics.totalRequests}`);
    console.log(`   Successful: ${metrics.successfulRequests}`);
    console.log(`   Failed: ${metrics.failedRequests}`);
    console.log(`   Avg Response: ${metrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`   Total Execution: ${metrics.totalExecutionTime}ms`);
  });

  // ============ Cleanup ============
  console.log("\n🧹 Cleanup\n");

  await runTest("Delete Sandbox", async () => {
    await sdk.deleteSandbox(sandboxId);
    console.log(`   Sandbox cleaned up`);
  });

  await runTest("Disconnect SDK", async () => {
    sdk.disconnect();
    console.log(`   SDK disconnected gracefully`);
  });

  // ============ Final Report ============
  console.log("\n╔════════════════════════════════════╗");
  console.log("║  📊 Test Report                    ║");
  console.log("╚════════════════════════════════════╝\n");

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests:  ${total}`);
  console.log(`✅ Passed:    ${passed}`);
  console.log(`❌ Failed:    ${failed}`);
  console.log(`⏱️  Duration:  ${totalDuration}ms\n`);

  if (failed > 0) {
    console.log("❌ Failed Tests:\n");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => {
        console.log(`  ${r.name}`);
        console.log(`  Error: ${r.error}\n`);
      });
  }

  console.log("✨ All tests completed!\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});