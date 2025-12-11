import express, { Router, Request, Response, NextFunction } from "express";
import { v4 as uuid } from "uuid";

// ============ Types ============

interface SandboxConfig {
  id: string;
  userId: string;
  templateId: string;
  templateConfig: any;
  status: string;
  containerId?: string;
  port?: number;
  exposedUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

interface CodeContext {
  id: string;
  sandboxId: string;
  language: string;
  cwd: string;
  createdAt: Date;
}

// ============ In-Memory Storage ============

const sandboxes = new Map<string, SandboxConfig>();
const contexts = new Map<string, CodeContext>();
const templates = new Map<string, any>();
const apiKeys = new Map<string, string>();

// ============ Utilities ============

function generateApiKey(): string {
  return "sk-" + uuid().replace(/-/g, "").substring(0, 32);
}

function isValidApiKey(apiKey: string): boolean {
  return apiKeys.has(apiKey);
}

function getUserIdFromApiKey(apiKey: string): string | null {
  return apiKeys.get(apiKey) || null;
}

// ============ Middleware ============

const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  // Skip auth for health and register endpoints
  if (req.path === "/api/health" || req.path === "/api/auth/register") {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid API key" });
  }

  const apiKey = authHeader.substring(7);

  if (!isValidApiKey(apiKey)) {
    return res.status(401).json({ message: "Invalid API key" });
  }

  const userId = getUserIdFromApiKey(apiKey);
  if (!userId) {
    return res.status(401).json({ message: "Invalid API key" });
  }

  (req as any).userId = userId;
  (req as any).apiKey = apiKey;
  next();
};

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("[ERROR]", err);
  res.status(500).json({
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

// ============ Routes ============

const router = Router();

// Health check (no auth required)
router.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Auth - Register (no auth required)
router.post("/api/auth/register", (req: Request, res: Response) => {
  try {
    const { username, email } = req.body;

    if (!username || !email) {
      return res
        .status(400)
        .json({ message: "username and email are required" });
    }

    const userId = uuid();
    const apiKey = generateApiKey();

    apiKeys.set(apiKey, userId);

    console.log(`✅ User registered: ${username} (${userId})`);

    res.status(201).json({
      userId,
      apiKey,
      message: "User registered successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to register user",
      error: String(error),
    });
  }
});

// ============ SANDBOX ENDPOINTS ============

// POST /api/sandboxes/create
router.post("/api/sandboxes/create", (req: Request, res: Response) => {
  try {
    const {
      templateId,
      name,
      expiryTime,
      initialEnvVars,
      metadata,
      autoStart,
    } = req.body;
    const userId = (req as any).userId;

    if (!templateId) {
      return res.status(400).json({ message: "templateId is required" });
    }

    const template = templates.get(templateId);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const sandboxId = uuid();
    const containerPort = 3000 + Math.floor(Math.random() * 1000);

    const sandbox: SandboxConfig = {
      id: sandboxId,
      userId,
      templateId,
      templateConfig: template.config,
      status: autoStart ? "running" : "ready",
      containerId: `container-${uuid()}`,
      port: containerPort,
      exposedUrl: `http://localhost:${containerPort}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: expiryTime
        ? new Date(Date.now() + expiryTime)
        : undefined,
      metadata,
    };

    sandboxes.set(sandboxId, sandbox);

    console.log(`✅ Sandbox created: ${sandboxId}`);

    res.status(201).json({
      sandbox,
      credentials: {
        apiKey: (req as any).apiKey,
      },
    });
  } catch (error) {
    console.error("Create sandbox error:", error);
    res.status(500).json({
      message: "Failed to create sandbox",
      error: String(error),
    });
  }
});

// DELETE /api/sandboxes/:sandboxId
router.delete("/api/sandboxes/:sandboxId", (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;
    const userId = (req as any).userId;

    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) {
      return res.status(404).json({ message: "Sandbox not found" });
    }

    if (sandbox.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Delete associated contexts
    for (const [contextId, context] of contexts.entries()) {
      if (context.sandboxId === sandboxId) {
        contexts.delete(contextId);
      }
    }

    sandboxes.delete(sandboxId);

    console.log(`✅ Sandbox deleted: ${sandboxId}`);

    res.json({ message: "Sandbox deleted successfully" });
  } catch (error) {
    console.error("Delete sandbox error:", error);
    res.status(500).json({
      message: "Failed to delete sandbox",
      error: String(error),
    });
  }
});

// GET /api/sandboxes/:sandboxId/status
router.get("/api/sandboxes/:sandboxId/status", (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;

    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) {
      return res.status(404).json({ message: "Sandbox not found" });
    }

    res.json({ status: sandbox.status });
  } catch (error) {
    console.error("Get status error:", error);
    res.status(500).json({
      message: "Failed to get sandbox status",
      error: String(error),
    });
  }
});

// GET /api/sandboxes
router.get("/api/sandboxes", (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const userSandboxes = Array.from(sandboxes.values()).filter(
      (s) => s.userId === userId
    );

    res.json({ sandboxes: userSandboxes });
  } catch (error) {
    console.error("List sandboxes error:", error);
    res.status(500).json({
      message: "Failed to list sandboxes",
      error: String(error),
    });
  }
});

// ============ CODE EXECUTION ENDPOINTS ============

// POST /api/sandboxes/:sandboxId/execute
router.post("/api/sandboxes/:sandboxId/execute", (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;
    const { code, language } = req.body;

    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) {
      return res.status(404).json({ message: "Sandbox not found" });
    }

    // Mock execution result
    const results = [
      {
        text: `Executed ${language} code successfully`,
        is_main_result: true,
      },
    ];

    res.json({
      results,
      logs: {
        stdout: [`Code executed in ${language}`],
        stderr: [],
      },
      executionCount: 1,
    });
  } catch (error) {
    console.error("Execute code error:", error);
    res.status(500).json({
      message: "Failed to execute code",
      error: String(error),
    });
  }
});

// POST /api/sandboxes/:sandboxId/terminal
router.post("/api/sandboxes/:sandboxId/terminal", (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;
    const { command } = req.body;

    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) {
      return res.status(404).json({ message: "Sandbox not found" });
    }

    const output = `$ ${command}\nCommand executed`;

    res.json({ output });
  } catch (error) {
    console.error("Execute terminal error:", error);
    res.status(500).json({
      message: "Failed to execute terminal command",
      error: String(error),
    });
  }
});

// ============ FILE MANAGEMENT ENDPOINTS ============

// GET /api/sandboxes/:sandboxId/files
router.get("/api/sandboxes/:sandboxId/files", (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;
    const { path: filePath } = req.query;

    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) {
      return res.status(404).json({ message: "Sandbox not found" });
    }

    if (!filePath) {
      return res
        .status(400)
        .json({ message: "path query parameter is required" });
    }

    const content = `Content of file: ${filePath}`;

    res.json({ content });
  } catch (error) {
    console.error("Read file error:", error);
    res.status(500).json({
      message: "Failed to read file",
      error: String(error),
    });
  }
});

// POST /api/sandboxes/:sandboxId/files
router.post("/api/sandboxes/:sandboxId/files", (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;
    const { path: filePath } = req.query;
    const { content } = req.body;

    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) {
      return res.status(404).json({ message: "Sandbox not found" });
    }

    if (!filePath) {
      return res
        .status(400)
        .json({ message: "path query parameter is required" });
    }

    res.json({ path: filePath });
  } catch (error) {
    console.error("Write file error:", error);
    res.status(500).json({
      message: "Failed to write file",
      error: String(error),
    });
  }
});

// DELETE /api/sandboxes/:sandboxId/files
router.delete("/api/sandboxes/:sandboxId/files", (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;
    const { path: filePath } = req.query;

    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) {
      return res.status(404).json({ message: "Sandbox not found" });
    }

    if (!filePath) {
      return res
        .status(400)
        .json({ message: "path query parameter is required" });
    }

    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete file error:", error);
    res.status(500).json({
      message: "Failed to delete file",
      error: String(error),
    });
  }
});

// GET /api/sandboxes/:sandboxId/files/list
router.get(
  "/api/sandboxes/:sandboxId/files/list",
  (req: Request, res: Response) => {
    try {
      const { sandboxId } = req.params;
      const { path: dirPath } = req.query;

      const sandbox = sandboxes.get(sandboxId);
      if (!sandbox) {
        return res.status(404).json({ message: "Sandbox not found" });
      }

      const files = [
        {
          path: "file1.txt",
          isDirectory: false,
          size: 1024,
          createdAt: new Date(),
          modifiedAt: new Date(),
        },
      ];

      res.json({ files, directory: dirPath || "." });
    } catch (error) {
      console.error("List files error:", error);
      res.status(500).json({
        message: "Failed to list files",
        error: String(error),
      });
    }
  }
);

// ============ CONTEXT ENDPOINTS ============

// POST /api/sandboxes/:sandboxId/contexts
router.post("/api/sandboxes/:sandboxId/contexts", (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;
    const { language, cwd } = req.body;

    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) {
      return res.status(404).json({ message: "Sandbox not found" });
    }

    const contextId = uuid();
    const context: CodeContext = {
      id: contextId,
      sandboxId,
      language: language || sandbox.templateConfig.language,
      cwd: cwd || "/workspace",
      createdAt: new Date(),
    };

    contexts.set(contextId, context);

    console.log(`✅ Context created: ${contextId}`);

    res.status(201).json(context);
  } catch (error) {
    console.error("Create context error:", error);
    res.status(500).json({
      message: "Failed to create context",
      error: String(error),
    });
  }
});

// DELETE /api/sandboxes/:sandboxId/contexts/:contextId
router.delete(
  "/api/sandboxes/:sandboxId/contexts/:contextId",
  (req: Request, res: Response) => {
    try {
      const { contextId } = req.params;

      const context = contexts.get(contextId);
      if (!context) {
        return res.status(404).json({ message: "Context not found" });
      }

      contexts.delete(contextId);

      console.log(`✅ Context deleted: ${contextId}`);

      res.json({ message: "Context deleted successfully" });
    } catch (error) {
      console.error("Delete context error:", error);
      res.status(500).json({
        message: "Failed to delete context",
        error: String(error),
      });
    }
  }
);

// ============ TEMPLATE ENDPOINTS ============

// GET /api/templates
router.get("/api/templates", (req: Request, res: Response) => {
  try {
    const { page = "1", pageSize = "10" } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;

    const allTemplates = Array.from(templates.values());
    const start = (pageNum - 1) * pageSizeNum;
    const paginatedTemplates = allTemplates.slice(
      start,
      start + pageSizeNum
    );

    res.json({
      templates: paginatedTemplates,
      total: allTemplates.length,
      page: pageNum,
      pageSize: pageSizeNum,
    });
  } catch (error) {
    console.error("List templates error:", error);
    res.status(500).json({
      message: "Failed to list templates",
      error: String(error),
    });
  }
});

// GET /api/templates/:templateId
router.get("/api/templates/:templateId", (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;

    const template = templates.get(templateId);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    console.error("Get template error:", error);
    res.status(500).json({
      message: "Failed to get template",
      error: String(error),
    });
  }
});

// POST /api/templates
router.post("/api/templates", (req: Request, res: Response) => {
  try {
    const templateId = uuid();
    const template = {
      id: templateId,
      config: req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublic: false,
      authorId: (req as any).userId,
    };

    templates.set(templateId, template);

    console.log(`✅ Template created: ${templateId}`);

    res.status(201).json(template);
  } catch (error) {
    console.error("Create template error:", error);
    res.status(500).json({
      message: "Failed to create template",
      error: String(error),
    });
  }
});

// ============ Server Setup ============

function setupApp(): express.Application {
  const app = express();

  // Middleware
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Request logging
  app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path}`);
    next();
  });

  // Apply auth middleware
  app.use(apiKeyAuth);

  // Apply routes
  app.use(router);

  // Error handling
  app.use(errorHandler);

  return app;
}

// ============ Main ============

const PORT = process.env.PORT || 3000;
const app = setupApp();

app.listen(PORT, () => {
  console.log("\n");
  console.log("╔════════════════════════════════════╗");
  console.log("║   🚀 Sandbox Server Started        ║");
  console.log(`║   Port: ${PORT}                       ║`);
  console.log("╚════════════════════════════════════╝");
  console.log("\n📚 API Documentation:");
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`   Register: POST http://localhost:${PORT}/api/auth/register`);
  console.log("\n");
});