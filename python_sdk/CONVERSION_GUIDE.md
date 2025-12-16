# TypeScript to Python Conversion Guide

## Overview

This document outlines the conversion of the Sandbox SDK from TypeScript to Python, highlighting key differences and mapping between the two implementations.

## Key Conversions

### 1. Type System

#### TypeScript
```typescript
interface SandboxConfig {
  id: string;
  userId: string;
  templateId: string;
  status: SandboxStatus;
}

type CreateSandboxOptions = {
  templateId: string;
  name?: string;
};
```

#### Python
```python
from dataclasses import dataclass

@dataclass
class SandboxConfig:
    id: str
    user_id: str
    template_id: str
    status: SandboxStatus

@dataclass
class CreateSandboxOptions:
    template_id: str
    name: Optional[str] = None
```

**Differences:**
- TypeScript interfaces → Python dataclasses
- `camelCase` → `snake_case`
- `?` (optional) → `Optional[Type]` or default values
- `enum` → Python `Enum` class

### 2. Error Handling

#### TypeScript
```typescript
export class ExecutionError extends Error {
  constructor(
    public readonly name: string,
    public readonly value: string,
    public readonly traceback: string
  ) {
    super(value);
  }
}

try {
  await sdk.runCode(sandboxId, code);
} catch (error) {
  if (error instanceof ExecutionError) {
    console.log(error.traceback);
  }
}
```

#### Python
```python
class ExecutionError(Exception):
    def __init__(self, name: str, value: str, traceback: str):
        self.name = name
        self.value = value
        self.traceback = traceback
        super().__init__(value)

try:
    sdk.run_code(sandbox_id, code)
except ExecutionError as e:
    print(e.traceback)
```

**Differences:**
- TypeScript `Error` → Python `Exception`
- Method inheritance works similarly
- Exception names follow snake_case in Python

### 3. Async/Await

#### TypeScript
```typescript
async runCode(
  sandboxId: string,
  code: string,
  opts?: RunCodeOptions
): Promise<ExecutionResult> {
  const response = await this.makeRequest(
    "POST",
    `/api/sandboxes/${sandboxId}/execute`,
    payload,
    opts?.timeoutMs
  );
  return response;
}
```

#### Python
```python
def run_code(
    self,
    sandbox_id: str,
    code: str,
    opts: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    response = self._make_request(
        "POST",
        f"/api/sandboxes/{sandbox_id}/execute",
        payload,
        opts.get("timeout_ms") if opts else None
    )
    return response
```

**Differences:**
- `async/await` → synchronous (requests library handles this)
- `Promise<T>` → return type hints
- `?.` optional chaining → `.get()` with defaults
- Template literals → f-strings

### 4. Collections

#### TypeScript
```typescript
private activeSandboxes: Map<string, SandboxConfig> = new Map();

this.activeSandboxes.set(sandbox.id, sandbox);
const sandbox = this.activeSandboxes.get(sandboxId);
this.activeSandboxes.delete(sandboxId);
```

#### Python
```python
self.active_sandboxes = {}

self.active_sandboxes[sandbox["id"]] = sandbox
sandbox = self.active_sandboxes.get(sandbox_id)
del self.active_sandboxes[sandbox_id]
```

**Differences:**
- `Map<K, V>` → Python `dict`
- `.set()` → dict assignment
- `.get()` works the same
- `.delete()` → `del` keyword

### 5. Callbacks

#### TypeScript
```typescript
interface RunCodeOptions {
  onStdout?: (output: OutputMessage) => Promise<void> | void;
  onStderr?: (output: OutputMessage) => Promise<void> | void;
  onResult?: (result: Result) => Promise<void> | void;
  onError?: (error: ExecutionError) => Promise<void> | void;
}

if (opts?.onResult && execution.results.length > 0) {
  for (const result of execution.results) {
    await opts.onResult(result);
  }
}
```

#### Python
```python
@dataclass
class RunCodeOptions:
    on_stdout: Optional[Callable[[OutputMessage], None]] = None
    on_stderr: Optional[Callable[[OutputMessage], None]] = None
    on_result: Optional[Callable[[Result], None]] = None
    on_error: Optional[Callable[[ExecutionError], None]] = None

# Or using dict:
opts: Dict[str, Callable] = {
    "on_stdout": lambda msg: print(f"STDOUT: {msg.line}"),
}

if opts.get("on_result") and execution.results:
    for result in execution.results:
        opts["on_result"](result)
```

**Differences:**
- Callbacks don't support async in this implementation
- Use `Callable` type hints
- Pass as dict keys in Python
- No `await` for callbacks (use threading if needed)

### 6. Timers/Intervals

#### TypeScript
```typescript
private metricsInterval: NodeJS.Timeout | null = null;

this.metricsInterval = setInterval(() => {
  const metrics = this.getMetrics();
}, this.config.metricsInterval);

clearInterval(this.metricsInterval);
```

#### Python
```python
from threading import Timer

self.metrics_interval = None

def collect_metrics():
    metrics = self.get_metrics()
    self.metrics_interval = Timer(
        self.config["metrics_interval"] / 1000,
        collect_metrics
    )
    self.metrics_interval.daemon = True
    self.metrics_interval.start()

if self.metrics_interval:
    self.metrics_interval.cancel()
```

**Differences:**
- TypeScript `setInterval()` → Python `threading.Timer`
- Must manually reschedule after each execution
- Set `daemon=True` for background threads
- Use `.cancel()` instead of `clearInterval`

### 7. UUID Generation

#### TypeScript
```typescript
import { v4 as uuid } from "uuid";

const executionId = uuid();
```

#### Python
```python
import uuid

execution_id = str(uuid.uuid4())
```

**Differences:**
- `uuid` npm package → Python built-in `uuid` module
- Convert to string in Python

### 8. Logging

#### TypeScript
```typescript
private log(level: string, message: string): void {
  if (!this.config.enableLogging) return;
  
  const levels = ["debug", "info", "warn", "error"];
  const currentLevelIndex = levels.indexOf(this.config.logLevel);
  const messageLevelIndex = levels.indexOf(level);
  
  if (messageLevelIndex >= currentLevelIndex) {
    console.log(`[${level.toUpperCase()}] ${message}`);
  }
}
```

#### Python
```python
import logging

def _log(self, level: str, message: str) -> None:
    if not self.config["enable_logging"]:
        return
    
    levels = ["debug", "info", "warn", "error"]
    current_level_index = levels.index(self.config["log_level"])
    message_level_index = levels.index(level) if level in levels else 1
    
    if message_level_index >= current_level_index:
        log_method = getattr(self.logger, level, self.logger.info)
        log_method(message)
```

**Differences:**
- `console.log()` → Python `logging` module
- More powerful logging framework in Python
- Can use `.getLogger()` for module-specific loggers

### 9. HTTP Requests

#### TypeScript
```typescript
private async makeRequest<T = unknown>(
  method: string,
  endpoint: string,
  payload?: unknown,
  timeoutMs?: number
): Promise<T> {
  const url = `${this.config.serverUrl}${endpoint}`;
  const timeout = timeoutMs || this.config.timeout;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const response = await fetch(url, {
    method,
    headers: { "Authorization": `Bearer ${this.config.apiKey}` },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
  
  clearTimeout(timeoutId);
  
  if (!response.ok) {
    throw new SandboxError(...);
  }
  
  return await response.json();
}
```

#### Python
```python
def _make_request(
    self,
    method: str,
    endpoint: str,
    payload: Optional[Dict[str, Any]] = None,
    timeout_ms: Optional[int] = None
) -> Dict[str, Any]:
    url = f"{self.config['server_url']}{endpoint}"
    timeout = (timeout_ms or self.config["timeout"]) / 1000
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {self.config['api_key']}",
    }
    
    try:
        response = requests.request(
            method,
            url,
            json=payload,
            headers=headers,
            timeout=timeout
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        # Handle error
        pass
```

**Differences:**
- `fetch()` → `requests` library
- `AbortController` → `timeout` parameter (built-in)
- `response.ok` → `.raise_for_status()`
- `await response.json()` → `.json()` (synchronous)
- Milliseconds → seconds conversion needed

### 10. Object Serialization

#### TypeScript
```typescript
toJSON() {
  return {
    results: this.results,
    logs: this.logs,
    error: this.error,
  };
}
```

#### Python
```python
from dataclasses import asdict

def to_dict(self) -> Dict[str, Any]:
    return {
        "results": [r.to_dict() for r in self.results],
        "logs": asdict(self.logs),
        "error": {
            "name": self.error.name,
            "value": self.error.value,
            "traceback": self.error.traceback,
        } if self.error else None,
    }

# Or using dataclasses:
result_dict = asdict(execution)
```

**Differences:**
- `toJSON()` → `to_dict()` method
- Use `asdict()` from dataclasses for conversion
- Manual serialization for complex objects

## File Organization

### TypeScript Structure
```
├── index.ts (Main SDK class + errors + execution classes)
├── typesv2.ts (Type definitions)
```

### Python Structure
```
├── sandbox_sdk.py (Main SDK class + errors + execution classes)
├── types.py (Type definitions)
├── examples.py (Usage examples)
├── README.md (Documentation)
└── requirements.txt (Dependencies)
```

## Method Naming Conventions

| TypeScript | Python |
|-----------|--------|
| `createSandbox()` | `create_sandbox()` |
| `deleteSandbox()` | `delete_sandbox()` |
| `getSandboxStatus()` | `get_sandbox_status()` |
| `listSandboxes()` | `list_sandboxes()` |
| `makeRequest()` | `_make_request()` |
| `checkRateLimit()` | `_check_rate_limit()` |

Python uses snake_case with leading underscore for private methods.

## Enum Usage

### TypeScript
```typescript
export enum SandboxStatus {
  CREATING = "creating",
  READY = "ready",
  RUNNING = "running",
  STOPPED = "stopped",
  ERROR = "error",
  TERMINATED = "terminated"
}
```

### Python
```python
from enum import Enum

class SandboxStatus(str, Enum):
    CREATING = "creating"
    READY = "ready"
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"
    TERMINATED = "terminated"
```

**Differences:**
- Python `Enum` class with `str` mixin
- Inherits from `str, Enum` for string comparison

## Performance Considerations

1. **Synchronous vs Async**: Python version is synchronous. For async support, use `asyncio` and `aiohttp`:
   ```python
   import asyncio
   import aiohttp
   
   async def run_code_async(self, sandbox_id, code):
       async with aiohttp.ClientSession() as session:
           async with session.post(url, json=payload) as resp:
               return await resp.json()
   ```

2. **Threading**: Use `concurrent.futures` or `asyncio` for concurrent operations:
   ```python
   from concurrent.futures import ThreadPoolExecutor
   
   with ThreadPoolExecutor(max_workers=5) as executor:
       futures = [executor.submit(sdk.run_code, id, code) for id, code in jobs]
   ```

3. **Metrics**: Python's `threading.Timer` is less efficient than JS intervals. Consider using `schedule` library:
   ```python
   import schedule
   
   schedule.every(30).seconds.do(self.collect_metrics)
   ```

## Testing

Convert jest/mocha tests to pytest:

```python
# test_sandbox_sdk.py
import pytest
from sandbox_sdk import SandboxSDK, SandboxError

def test_create_sandbox():
    sdk = SandboxSDK({...})
    response = sdk.create_sandbox({...})
    assert "sandbox" in response
    assert response["sandbox"]["id"]

def test_invalid_config():
    with pytest.raises(SandboxSDKError):
        SandboxSDK({"server_url": "..."})  # Missing api_key

@pytest.mark.asyncio
async def test_async_code():
    # Test async operations
    pass
```

## Migration Checklist

- [x] Convert error classes
- [x] Convert data classes and types
- [x] Convert main SDK class
- [x] Convert metrics collector
- [x] Convert rate limiter
- [x] Convert HTTP request handler
- [x] Convert sandbox management methods
- [x] Convert code execution methods
- [x] Convert file operations
- [x] Convert context management
- [x] Convert batch operations
- [x] Convert metrics collection
- [x] Update documentation
- [x] Create examples
- [ ] Add async support (optional)
- [ ] Add comprehensive tests
- [ ] Add type checking (mypy)

## Future Enhancements

1. **Async Support**: Add `asyncio` and `aiohttp` support
2. **Connection Pooling**: Use connection pools for HTTP requests
3. **Caching**: Add response caching for template/status queries
4. **Retry Logic**: Implement exponential backoff
5. **Type Checking**: Full mypy compliance
6. **Comprehensive Tests**: Full pytest coverage
7. **Context Manager**: Support `with` statement
8. **WebSocket Support**: For real-time communication

## Conclusion

The Python implementation maintains feature parity with the TypeScript version while following Python conventions and best practices. The main differences are:

1. Synchronous instead of async (can be added with asyncio)
2. Snake_case instead of camelCase
3. Python dataclasses instead of TypeScript interfaces
4. Different HTTP library (requests vs fetch)
5. Different logging approach
6. Threading for intervals instead of setInterval

All core functionality is preserved and the API is familiar to users of the TypeScript version.
