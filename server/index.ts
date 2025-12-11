/**
 * SandboxSDK Dummy Server
 * 
 * A simple Socket.IO server for testing the SandboxSDK
 * Simulates sandbox creation, code execution, file operations, etc.
 * 
 * Usage:
 * npx ts-node server.ts
 * 
 * or with node:
 * npm run build:server
 * node dist/server.js
 */

import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { v4 as uuid } from "uuid";

// ============ Types ============

interface Sandbox {
  id: string;
  userId: string;
  templateId: string;
  name: string;
  status: "creating" | "ready" | "running" | "stopped" | "error" | "terminated";
  createdAt: Date;
  expiresAt?: Date;
  files: Map<string, string>;
}

interface CodeContext {
  id: string;
  sandboxId: string;
  language: string;
  cwd: string;
  variables: Map<string, unknown>;
  createdAt: Date;
}

// ============ Configuration ============

const PORT = process.env.PORT || 3000;
const ENABLE_LOGS = process.env.ENABLE_LOGS !== "false";

// ============ Storage (In-Memory) ============

const sandboxes = new Map<string, Sandbox>();
const contexts = new Map<string, CodeContext>();
const templates = [
  {
    id: "python-3-11",
    name: "Python 3.11",
    language: "python",
    version: "3.11",
  },
  {
    id: "python-3-10",
    name: "Python 3.10",
    language: "python",
    version: "3.10",
  },
  {
    id: "nodejs-18",
    name: "Node.js 18",
    language: "javascript",
    version: "18",
  },
  {
    id: "nodejs-20",
    name: "Node.js 20",
    language: "javascript",
    version: "20",
  },
];

// ============ Helper Functions ============

function log(level: string, message: string): void {
  if (!ENABLE_LOGS) return;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function executeCode(code: string, language: string): {
  stdout: string[];
  stderr: string[];
  exitCode: number;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];

  // Simple code execution simulation
  try {
    if (language === "python" || language === "python-3-11" || language === "python-3-10") {
      // Simulate Python execution
      if (code.includes("raise")) {
        stderr.push("Error: Exception raised");
        return { stdout, stderr, exitCode: 1 };
      }

      // Extract print statements
      const printRegex = /print\((.*?)\)/g;
      let match;
      while ((match = printRegex.exec(code)) !== null) {
        const output = match[1].replace(/["']/g, "").trim();
        stdout.push(output);
      }

      // If no print, just return success
      if (stdout.length === 0) {
        stdout.push("Code executed successfully");
      }

      return { stdout, stderr, exitCode: 0 };
    } else if (language === "javascript" || language === "nodejs-18" || language === "nodejs-20") {
      // Simulate JavaScript execution
      if (code.includes("throw")) {
        stderr.push("Error: Exception thrown");
        return { stdout, stderr, exitCode: 1 };
      }

      const consoleLogRegex = /console\.log\((.*?)\)/g;
      let match;
      while ((match = consoleLogRegex.exec(code)) !== null) {
        const output = match[1].replace(/["']/g, "").trim();
        stdout.push(output);
      }

      if (stdout.length === 0) {
        stdout.push("Code executed successfully");
      }

      return { stdout, stderr, exitCode: 0 };
    }
  } catch (error) {
    stderr.push(String(error));
    return { stdout, stderr, exitCode: 1 };
  }

  return { stdout, stderr, exitCode: 0 };
}

// ============ Socket.IO Server ============

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.use((socket, next) => {
  const apiKey = socket.handshake.auth.apiKey;

  if (!apiKey) {
    return next(new Error("Invalid API key"));
  }

  // Simple validation (in real server, check against database)
  if (apiKey !== "sk_test_your_api_key_here" && !apiKey.startsWith("sk_test_")) {
    return next(new Error("Invalid API key"));
  }

  next();
});

io.on("connection", (socket: Socket) => {
  log("info", `Client connected: ${socket.id}`);

  // ============ Sandbox Events ============

  socket.on("sandbox:create", async (jobId: string, payload: Buffer) => {
    console.log("paylod:", payload);
    
    try {
      const data = JSON.parse(payload.toString());
      const sandboxId = uuid();

      const sandbox: Sandbox = {
        id: sandboxId,
        userId: socket.id,
        templateId: data.templateId,
        name: data.name || `Sandbox ${sandboxId.slice(0, 8)}`,
        status: "ready",
        createdAt: new Date(),
        expiresAt: data.expiryTime ? new Date(Date.now() + data.expiryTime) : undefined,
        files: new Map(),
      };

      sandboxes.set(sandboxId, sandbox);
      log("info", `Sandbox created: ${sandboxId}`);

      socket.emit("job:result", {
        jobId,
        success: true,
        output: {
          id: sandbox.id,
          userId: sandbox.userId,
          templateId: sandbox.templateId,
          name: sandbox.name,
          status: sandbox.status,
          createdAt: sandbox.createdAt,
          expiresAt: sandbox.expiresAt,
        },
      });
    } catch (error) {
      log("error", `Sandbox creation error: ${error}`);
      socket.emit("job:result", {
        jobId,
        success: false,
        error: String(error),
      });
    }
  });

  socket.on("sandbox:delete", async (jobId: string, payload: Buffer) => {
    try {
      const data = JSON.parse(payload.toString());
      sandboxes.delete(data.sandboxId);

      // Also delete contexts for this sandbox
      for (const [contextId, context] of contexts.entries()) {
        if (context.sandboxId === data.sandboxId) {
          contexts.delete(contextId);
        }
      }

      log("info", `Sandbox deleted: ${data.sandboxId}`);

      socket.emit("job:result", {
        jobId,
        success: true,
        output: null,
      });
    } catch (error) {
      socket.emit("job:result", {
        jobId,
        success: false,
        error: String(error),
      });
    }
  });

  socket.on("sandbox:status", async (jobId: string, payload: Buffer) => {
    try {
      const data = JSON.parse(payload.toString());
      const sandbox = sandboxes.get(data.sandboxId);

      if (!sandbox) {
        throw new Error(`Sandbox not found: ${data.sandboxId}`);
      }

      socket.emit("job:result", {
        jobId,
        success: true,
        output: { status: sandbox.status },
      });
    } catch (error) {
      socket.emit("job:result", {
        jobId,
        success: false,
        error: String(error),
      });
    }
  });

  // ============ Code Execution ============

  socket.on("job:execute", async (jobId: string, payload: Buffer) => {
    try {
      const data = JSON.parse(payload.toString());
      const sandbox = sandboxes.get(data.sandboxId);

      if (!sandbox) {
        throw new Error(`Sandbox not found: ${data.sandboxId}`);
      }

      await delay(500); // Simulate execution time

      const { stdout, stderr, exitCode } = executeCode(data.code, data.language);

      // Send stdout
      for (const line of stdout) {
        socket.emit("job:output", {
          jobId,
          line: JSON.stringify({
            type: "stdout",
            text: line,
          }),
        });
      }

      // Send stderr if any
      for (const line of stderr) {
        socket.emit("job:output", {
          jobId,
          line: JSON.stringify({
            type: "stderr",
            text: line,
          }),
        });
      }

      // Send result
      socket.emit("job:output", {
        jobId,
        line: JSON.stringify({
          type: "result",
          text: stdout.join("\n"),
          is_main_result: true,
        }),
      });

      log("info", `Code executed in sandbox: ${data.sandboxId}`);
    } catch (error) {
      socket.emit("job:output", {
        jobId,
        line: JSON.stringify({
          type: "error",
          name: "ExecutionError",
          value: String(error),
          traceback: String(error),
        }),
      });
    }
  });

  // ============ Terminal Commands ============

  socket.on("job:terminal", async (jobId: string, payload: Buffer) => {
    try {
      const data = JSON.parse(payload.toString());

      await delay(300); // Simulate command execution

      // Simple command simulation
      let output = "";
      if (data.command.includes("ls")) {
        output = "file1.py\nfile2.js\ndata.csv\n";
      } else if (data.command.includes("pwd")) {
        output = "/workspace\n";
      } else if (data.command.includes("pip")) {
        output = "Successfully installed packages\n";
      } else if (data.command.includes("node")) {
        output = "v18.0.0\n";
      } else {
        output = "Command executed successfully\n";
      }

      socket.emit("job:stream", {
        jobId,
        chunk: output,
      });

      socket.emit("job:stream:end", {
        jobId,
        exitCode: 0,
      });

      log("info", `Terminal command executed: ${data.command}`);
    } catch (error) {
      socket.emit("job:stream", {
        jobId,
        chunk: `Error: ${error}\n`,
      });

      socket.emit("job:stream:end", {
        jobId,
        exitCode: 1,
      });
    }
  });

  // ============ File Operations ============

  socket.on("job:file", async (jobId: string, payload: Buffer) => {
    try {
      const data = JSON.parse(payload.toString());
      const sandbox = sandboxes.get(data.sandboxId);

      if (!sandbox) {
        throw new Error(`Sandbox not found: ${data.sandboxId}`);
      }

      if (data.op === "read") {
        const content = sandbox.files.get(data.path);
        if (!content) {
          throw new Error(`File not found: ${data.path}`);
        }

        socket.emit("job:result", {
          jobId,
          success: true,
          output: content,
        });
      } else if (data.op === "write") {
        sandbox.files.set(data.path, data.content);

        socket.emit("job:result", {
          jobId,
          success: true,
          output: `File written: ${data.path}`,
        });
      } else if (data.op === "delete") {
        sandbox.files.delete(data.path);

        socket.emit("job:result", {
          jobId,
          success: true,
          output: `File deleted: ${data.path}`,
        });
      }

      log("info", `File operation (${data.op}): ${data.path}`);
    } catch (error) {
      socket.emit("job:result", {
        jobId,
        success: false,
        error: String(error),
      });
    }
  });

  // ============ File Listing ============

  socket.on("file:list", async (jobId: string, payload: Buffer) => {
    try {
      const data = JSON.parse(payload.toString());
      const sandbox = sandboxes.get(data.sandboxId);

      if (!sandbox) {
        throw new Error(`Sandbox not found: ${data.sandboxId}`);
      }

      const files = Array.from(sandbox.files.entries()).map(([path, content]) => ({
        path,
        isDirectory: false,
        size: content.length,
        createdAt: new Date(),
        modifiedAt: new Date(),
      }));

      socket.emit("job:result", {
        jobId,
        success: true,
        output: {
          files,
          directory: data.dirPath || "/workspace",
        },
      });
    } catch (error) {
      socket.emit("job:result", {
        jobId,
        success: false,
        error: String(error),
      });
    }
  });

  // ============ Context Management ============

  socket.on("context:create", async (jobId: string, payload: Buffer) => {
    try {
      const data = JSON.parse(payload.toString());
      const contextId = uuid();

      const context: CodeContext = {
        id: contextId,
        sandboxId: data.sandboxId,
        language: data.language,
        cwd: data.cwd,
        variables: new Map(),
        createdAt: new Date(),
      };

      contexts.set(contextId, context);

      socket.emit("job:result", {
        jobId,
        success: true,
        output: {
          id: context.id,
          sandboxId: context.sandboxId,
          language: context.language,
          cwd: context.cwd,
          createdAt: context.createdAt,
        },
      });

      log("info", `Context created: ${contextId}`);
    } catch (error) {
      socket.emit("job:result", {
        jobId,
        success: false,
        error: String(error),
      });
    }
  });

  socket.on("context:delete", async (jobId: string, payload: Buffer) => {
    try {
      const data = JSON.parse(payload.toString());
      contexts.delete(data.contextId);

      socket.emit("job:result", {
        jobId,
        success: true,
        output: null,
      });

      log("info", `Context deleted: ${data.contextId}`);
    } catch (error) {
      socket.emit("job:result", {
        jobId,
        success: false,
        error: String(error),
      });
    }
  });

  // ============ Template Management ============

  socket.on("template:list", async (jobId: string, payload: Buffer) => {
    try {
      socket.emit("job:result", {
        jobId,
        success: true,
        output: {
          templates: templates.map((t) => ({
            id: t.id,
            config: t,
            createdAt: new Date(),
            updatedAt: new Date(),
            isPublic: true,
          })),
          total: templates.length,
          page: 1,
          pageSize: 10,
        },
      });
    } catch (error) {
      socket.emit("job:result", {
        jobId,
        success: false,
        error: String(error),
      });
    }
  });

  socket.on("template:get", async (jobId: string, payload: Buffer) => {
    try {
      const data = JSON.parse(payload.toString());
      const template = templates.find((t) => t.id === data.templateId);

      if (!template) {
        throw new Error(`Template not found: ${data.templateId}`);
      }

      socket.emit("job:result", {
        jobId,
        success: true,
        output: {
          id: template.id,
          config: template,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPublic: true,
        },
      });
    } catch (error) {
      socket.emit("job:result", {
        jobId,
        success: false,
        error: String(error),
      });
    }
  });

  // ============ Disconnect ============

  socket.on("disconnect", () => {
    log("info", `Client disconnected: ${socket.id}`);

    // Clean up sandboxes for this user
    for (const [sandboxId, sandbox] of sandboxes.entries()) {
      if (sandbox.userId === socket.id) {
        sandboxes.delete(sandboxId);
      }
    }
  });
});

// ============ Start Server ============

httpServer.listen(PORT, () => {
  log("info", `🚀 SandboxSDK Dummy Server running on port ${PORT}`);
  log("info", `📝 API Key: sk_test_your_api_key_here`);
  log("info", `🔗 Server URL: http://localhost:${PORT}`);
  log("info", `✅ Ready to accept SDK connections`);
});