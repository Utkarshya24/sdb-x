// ============ Test Configuration ============

const TEST_SERVER_URL = "http://localhost:3000";
let testApiKey = "";
let testUserId = "";
let testSandboxId = "";
let testTemplateId = "";
let testContextId = "";

// ============ Test Utilities ============

const results = [];

async function test(name, fn) {
  const startTime = Date.now();
  try {
    await fn();
    const duration = Date.now() - startTime;
    results.push({
      name,
      status: "PASS",
      message: "✅ Test passed",
      duration,
    });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    results.push({
      name,
      status: "FAIL",
      message: "❌ Test failed",
      duration,
      error: String(error),
    });
    console.error(`❌ ${name} - ${String(error)}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} - Expected: ${expected}, Got: ${actual}`);
  }
}

function assertExists(value, message) {
  if (!value) {
    throw new Error(`${message} - Value does not exist`);
  }
}

// ============ Tests ============

async function runTests() {
  console.log("🚀 Starting API Tests...\n");

  // ============ Auth Tests ============
  console.log("📝 === AUTH TESTS ===\n");

  await test("Register User", async () => {
    const response = await fetch(`${TEST_SERVER_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "testuser",
        email: "test@example.com",
      }),
    });

    assert(response.ok, "Registration should succeed");
    const data = await response.json();
    assertExists(data.apiKey, "API key should be returned");
    assertExists(data.userId, "User ID should be returned");

    testApiKey = data.apiKey;
    testUserId = data.userId;
  });

  // ============ Template Tests ============
  console.log("\n🔧 === TEMPLATE TESTS ===\n");

  await test("Create Template", async () => {
    const response = await fetch(`${TEST_SERVER_URL}/api/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testApiKey}`,
      },
      body: JSON.stringify({
        name: "Python Test Template",
        language: "python",
        version: "3.9",
        dockerImage: "python:3.9",
        dependencies: ["requests", "numpy"],
      }),
    });

    assert(response.ok, "Template creation should succeed");
    const data = await response.json();
    assertExists(data.id, "Template ID should be returned");

    testTemplateId = data.id;
  });

  await test("Get Template", async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/templates/${testTemplateId}`,
      {
        headers: { Authorization: `Bearer ${testApiKey}` },
      }
    );

    assert(response.ok, "Get template should succeed");
    const data = await response.json();
    assertEquals(data.id, testTemplateId, "Template ID should match");
  });

  await test("List Templates", async () => {
    const response = await fetch(`${TEST_SERVER_URL}/api/templates?page=1&pageSize=10`, {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    assert(response.ok, "List templates should succeed");
    const data = await response.json();
    assertExists(data.templates, "Templates array should exist");
    assertExists(data.total, "Total count should exist");
  });

  // ============ Sandbox Tests ============
  console.log("\n🏠 === SANDBOX TESTS ===\n");

  await test("Create Sandbox", async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/sandboxes/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testApiKey}`,
        },
        body: JSON.stringify({
          templateId: testTemplateId,
          name: "Test Sandbox",
          autoStart: true,
          initialEnvVars: {
            TEST_VAR: "test_value",
          },
        }),
      }
    );

    assert(response.ok, "Sandbox creation should succeed");
    const data = await response.json();
    assertExists(data.sandbox.id, "Sandbox ID should be returned");

    testSandboxId = data.sandbox.id;
  });

  await test("Get Sandbox Status", async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/sandboxes/${testSandboxId}/status`,
      {
        headers: { Authorization: `Bearer ${testApiKey}` },
      }
    );

    assert(response.ok, "Get status should succeed");
    const data = await response.json();
    assertExists(data.status, "Status should be returned");
  });

  await test("List Sandboxes", async () => {
    const response = await fetch(`${TEST_SERVER_URL}/api/sandboxes`, {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    assert(response.ok, "List sandboxes should succeed");
    const data = await response.json();
    assertExists(data.sandboxes, "Sandboxes array should exist");
  });

  // ============ Code Execution Tests ============
  console.log("\n⚙️  === CODE EXECUTION TESTS ===\n");

  await test("Execute Python Code", async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/sandboxes/${testSandboxId}/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testApiKey}`,
        },
        body: JSON.stringify({
          code: 'print("Hello from Python")',
          language: "python",
        }),
      }
    );

    assert(response.ok, "Code execution should succeed");
    const data = await response.json();
    assertExists(data.results, "Results should be returned");
    assertExists(data.logs, "Logs should be returned");
    assert(
      data.results.length > 0,
      "Results array should not be empty"
    );
  });

  await test("Execute Terminal Command", async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/sandboxes/${testSandboxId}/terminal`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testApiKey}`,
        },
        body: JSON.stringify({
          command: "echo 'Hello from Terminal'",
        }),
      }
    );

    assert(response.ok, "Terminal execution should succeed");
    const data = await response.json();
    assertExists(data.output, "Output should be returned");
  });

  // ============ File Management Tests ============
  console.log("\n📁 === FILE MANAGEMENT TESTS ===\n");

  await test("Write File", async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/sandboxes/${testSandboxId}/files?path=/tmp/test.txt`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testApiKey}`,
        },
        body: JSON.stringify({
          content: "Hello, this is a test file!",
          createParents: true,
        }),
      }
    );

    assert(response.ok, "Write file should succeed");
    const data = await response.json();
    assertExists(data.path, "File path should be returned");
  });

  await test("Read File", async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/sandboxes/${testSandboxId}/files?path=/tmp/test.txt`,
      {
        headers: { Authorization: `Bearer ${testApiKey}` },
      }
    );

    assert(response.ok, "Read file should succeed");
    const data = await response.json();
    assertExists(data.content, "File content should be returned");
  });

  await test("List Files", async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/sandboxes/${testSandboxId}/files/list?path=/tmp`,
      {
        headers: { Authorization: `Bearer ${testApiKey}` },
      }
    );

    assert(response.ok, "List files should succeed");
    const data = await response.json();
    assertExists(data.files, "Files array should exist");
    assertExists(data.directory, "Directory path should be returned");
  });

  await test("Delete File", async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/sandboxes/${testSandboxId}/files?path=/tmp/test.txt`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${testApiKey}` },
      }
    );

    assert(response.ok, "Delete file should succeed");
  });

  // ============ Context Tests ============
  console.log("\n🎯 === CONTEXT TESTS ===\n");

  await test("Create Code Context", async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/sandboxes/${testSandboxId}/contexts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testApiKey}`,
        },
        body: JSON.stringify({
          language: "python",
          cwd: "/workspace",
        }),
      }
    );

    assert(response.ok, "Context creation should succeed");
    const data = await response.json();
    assertExists(data.id, "Context ID should be returned");

    testContextId = data.id;
  });

  await test("Delete Code Context", async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/sandboxes/${testSandboxId}/contexts/${testContextId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${testApiKey}` },
      }
    );

    assert(response.ok, "Context deletion should succeed");
  });

  // ============ Cleanup ============
  console.log("\n🧹 === CLEANUP ===\n");

  await test("Delete Sandbox", async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/sandboxes/${testSandboxId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${testApiKey}` },
      }
    );

    assert(response.ok, "Sandbox deletion should succeed");
  });

  // ============ Report ============
  console.log("\n\n📊 === TEST REPORT ===\n");

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms\n`);

  if (failed > 0) {
    console.log("Failed Tests:");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => {
        console.log(`\n  ❌ ${r.name}`);
        console.log(`     Error: ${r.error}`);
      });
  }

  console.log("\n✨ Test suite completed!");
  process.exit(failed > 0 ? 1 : 0);
}

// ============ Main ============

console.log("🔍 Sandbox API Test Suite\n");
console.log(`Server URL: ${TEST_SERVER_URL}\n`);

runTests().catch((error) => {
  console.error("Fatal error during tests:", error);
  process.exit(1);
});