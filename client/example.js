import SandboxAgent from "../sdk/src/agent.js";

// ============ Example 1: Simple Task ============

async function example1_SimpleTask() {
  console.log("\n📌 Example 1: Simple Task\n");

  const agent = new SandboxAgent({
    apiKey: "your-secret-api-key-here",
    serverUrl: "http://localhost:3000",
    autoCleanup: true,
    enableLogging: true,
    maxRetries: 2,
  });

  try {
    const result = await agent.executeTask(
      "Run Python code that calculates factorial of 10"
    );

    console.log("\n✅ Task Result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Task failed:", error);
  }

  agent.disconnect();
}

// ============ Example 2: JavaScript Task ============

async function example2_JavaScriptTask() {
  console.log("\n📌 Example 2: JavaScript Task\n");

  const agent = new SandboxAgent({
    apiKey: "your-secret-api-key-here",
    serverUrl: "http://localhost:3000",
    autoCleanup: true,
    enableLogging: true,
  });

  try {
    const result = await agent.executeTask(
      "Run Node.js code that prints fibonacci sequence"
    );

    console.log("\n✅ Task Result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Task failed:", error);
  }

  agent.disconnect();
}

// ============ Example 3: Multiple Tasks ============

async function example3_MultipleTasks() {
  console.log("\n📌 Example 3: Multiple Tasks\n");

  const agent = new SandboxAgent({
    apiKey: "your-secret-api-key-here",
    serverUrl: "http://localhost:3000",
    autoCleanup: true,
    enableLogging: true,
  });

  const tasks = [
    "Run Python code that calculates factorial of 5",
    "Run Python code that sorts an array",
    "Run Node.js code to print hello world",
  ];

  for (const task of tasks) {
    try {
      console.log(`\n🔄 Executing: ${task}`);
      const result = await agent.executeTask(task);
      console.log(`✅ Completed`);
    } catch (error) {
      console.error(`❌ Failed: ${error}`);
    }
  }

  // Print task history
  console.log("\n📊 Task History:");
  const history = agent.getTaskHistory();
  console.log(`Total tasks: ${history.length}`);
  console.log(
    `Completed: ${history.filter((t) => t.status === "completed").length}`
  );
  console.log(`Failed: ${history.filter((t) => t.status === "failed").length}`);

  agent.disconnect();
}

// ============ Example 4: Custom SDK Usage (Low-level) ============

async function example4_DirectSDKUsage() {
  console.log("\n📌 Example 4: Direct SDK Usage\n");

  const SandboxSDK = require("./sdk").default;

  const sdk = new SandboxSDK({
    apiKey: "your-secret-api-key-here",
    serverUrl: "http://localhost:3000",
    enableLogging: true,
  });

  try {
    // Create sandbox
    console.log("1️⃣  Creating sandbox...");
    const sandbox = await sdk.createSandbox({
      templateId: "python-3.11",
    });
    console.log(`✅ Sandbox created: ${sandbox.id}`);

    // Write file
    console.log("\n2️⃣  Writing file...");
    await sdk.writeFile(
      sandbox.id,
      "/workspace/test.py",
      `
import math
numbers = [1, 2, 3, 4, 5]
print(f"Sum: {sum(numbers)}")
print(f"Product: {math.prod(numbers)}")
`
    );
    console.log("✅ File written");

    // Execute code
    console.log("\n3️⃣  Executing code...");
    const execution = await sdk.runCode(
      sandbox.id,
      `
import math
numbers = [1, 2, 3, 4, 5]
print(f"Sum: {sum(numbers)}")
print(f"Product: {math.prod(numbers)}")
`,
      "python"
    );
    console.log("✅ Code executed");
    console.log("Output:", execution.text);

    // Run terminal command
    console.log("\n4️⃣  Running terminal command...");
    const termOutput = await sdk.runTerminal(sandbox.id, "ls -la /workspace");
    console.log("✅ Terminal output:");
    console.log(termOutput);

    // List files
    console.log("\n5️⃣  Listing files...");
    const files = await sdk.listFiles(sandbox.id, "/workspace");
    console.log("✅ Files:");
    console.log(files);

    // Delete file
    console.log("\n6️⃣  Deleting file...");
    await sdk.deleteFile(sandbox.id, "/workspace/test.py");
    console.log("✅ File deleted");

    // Delete sandbox
    console.log("\n7️⃣  Deleting sandbox...");
    await sdk.deleteSandbox(sandbox.id);
    console.log("✅ Sandbox deleted");
  } catch (error) {
    console.error("❌ Error:", error);
  }

  sdk.disconnect();
}

// ============ Example 5: Agent with Status Monitoring ============

async function example5_StatusMonitoring() {
  console.log("\n📌 Example 5: Status Monitoring\n");

  const agent = new SandboxAgent({
    apiKey: "your-secret-api-key-here",
    serverUrl: "http://localhost:3000",
    autoCleanup: true,
    enableLogging: true,
  });

  try {
    console.log("📊 Initial Status:");
    let status = await agent.getStatus();
    console.log(JSON.stringify(status, null, 2));

    // Execute task
    console.log("\n🚀 Executing task...");
    await agent.executeTask("Run Python code to calculate sum of array");

    // Check status after task
    console.log("\n📊 Status After Task:");
    status = await agent.getStatus();
    console.log(JSON.stringify(status, null, 2));

    // Get current task
    console.log("\n📋 Current Task:");
    const currentTask = agent.getCurrentTask();
    console.log(JSON.stringify(currentTask, null, 2));
  } catch (error) {
    console.error("❌ Error:", error);
  }

  agent.disconnect();
}

// ============ Main Function ============

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║       Sandbox Agent - Usage Examples                       ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Run examples (uncomment which one you want to test)

  // await example1_SimpleTask();
  // await example2_JavaScriptTask();
  // await example3_MultipleTasks();
  await example4_DirectSDKUsage();
  // await example5_StatusMonitoring();
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_SimpleTask,
  example2_JavaScriptTask,
  example3_MultipleTasks,
  example4_DirectSDKUsage,
  example5_StatusMonitoring,
};