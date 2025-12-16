# Sandbox SDK - Python Implementation

A Python implementation of the Sandbox SDK for executing code in isolated sandbox environments. This is a complete conversion from the original TypeScript implementation.

## Features

- 🚀 Create and manage sandbox instances
- 💾 File operations (read, write, delete, list)
- 🔄 Code execution with streaming output
- 🎯 Batch job execution
- 📊 Metrics collection and monitoring
- 🛑 Rate limiting and error handling
- 🔐 API key authentication
- ⏱️ Configurable timeouts and retries
- 📝 Comprehensive logging support

## Installation

### Requirements
- Python 3.8+
- `requests` library

### Setup

```bash
# Install dependencies
pip install requests

# Or using requirements.txt
pip install -r requirements.txt
```

## Quick Start

```python
from sandbox_sdk import SandboxSDK

# Initialize the SDK
sdk = SandboxSDK({
    "api_key": "your-api-key",
    "server_url": "https://api.sandbox.example.com",
    "enable_logging": True,
})

try:
    # Create a sandbox
    sandbox = sdk.create_sandbox({
        "template_id": "python-3.11",
        "name": "My Sandbox",
    })
    
    sandbox_id = sandbox["sandbox"]["id"]
    
    # Run code
    result = sdk.run_code(sandbox_id, "print('Hello, World!')")
    print(result["execution"].text)
    
    # Clean up
    sdk.delete_sandbox(sandbox_id)
    
finally:
    sdk.disconnect()
```

## API Documentation

### Initialization

```python
sdk = SandboxSDK({
    "api_key": str,              # Required: API key for authentication
    "server_url": str,           # Required: Server URL
    "timeout": int,              # Optional: Request timeout in ms (default: 60000)
    "max_retries": int,          # Optional: Max retry attempts (default: 3)
    "retry_delay": int,          # Optional: Delay between retries in ms (default: 1000)
    "enable_logging": bool,      # Optional: Enable logging (default: False)
    "log_level": str,            # Optional: Log level - "debug", "info", "warn", "error"
    "enable_metrics": bool,      # Optional: Enable metrics collection (default: False)
    "metrics_interval": int,     # Optional: Metrics collection interval in ms (default: 30000)
})
```

### Sandbox Management

#### Create Sandbox
```python
response = sdk.create_sandbox({
    "template_id": "python-3.11",  # Required
    "name": "My Sandbox",          # Optional
    "auto_start": True,            # Optional
    "expiry_time": 3600000,        # Optional: in milliseconds
    "initial_env_vars": {},        # Optional
    "metadata": {},                # Optional
})

sandbox_id = response["sandbox"]["id"]
```

#### Get Sandbox Status
```python
status = sdk.get_sandbox_status(sandbox_id)
# Returns: "creating", "ready", "running", "stopped", "error", "terminated"
```

#### List Sandboxes
```python
sandboxes = sdk.list_sandboxes()
```

#### Delete Sandbox
```python
sdk.delete_sandbox(sandbox_id)
```

### Code Execution

#### Run Code
```python
result = sdk.run_code(
    sandbox_id,
    "print('Hello')\n42",
    {
        "timeout_ms": 5000,           # Optional
        "envs": {"KEY": "value"},     # Optional: environment variables
        "on_stdout": callback,        # Optional: streaming callback
        "on_stderr": callback,        # Optional: streaming callback
        "on_result": callback,        # Optional: result callback
        "on_error": callback,         # Optional: error callback
    }
)

# Access results
print(result["execution"].text)
print(result["execution"].logs.stdout)
print(result["metadata"]["duration"])  # in milliseconds
```

#### Run Terminal Command
```python
output = sdk.run_terminal(
    sandbox_id,
    "ls -la /workspace",
    {"timeout_ms": 5000}
)
```

#### Batch Execution
```python
jobs = [
    {"id": "job-1", "code": "2+2", "timeout": 5000},
    {"id": "job-2", "code": "3*3", "timeout": 5000},
]

results = sdk.execute_batch(sandbox_id, jobs)

for result in results:
    print(f"Job {result['job_id']}: {result['success']}")
```

### File Operations

#### Read File
```python
content = sdk.read_file(sandbox_id, "/workspace/file.txt")
```

#### Write File
```python
path = sdk.write_file(
    sandbox_id,
    "/workspace/file.txt",
    "Hello, World!",
    create_parents=True
)
```

#### Delete File
```python
sdk.delete_file(sandbox_id, "/workspace/file.txt")
```

#### List Files
```python
files = sdk.list_files(sandbox_id, "/workspace")
# Returns: {"files": [...], "directory": "/workspace"}
```

### Context Management

#### Create Code Context
```python
context = sdk.create_code_context(
    sandbox_id,
    language="python",
    cwd="/workspace",
)
```

#### List Contexts
```python
contexts = sdk.list_code_contexts(sandbox_id)
```

#### Delete Context
```python
sdk.delete_code_context(context["id"])
```

### Template Management

#### Get Templates
```python
response = sdk.get_templates(page=1, page_size=10)
# Returns: {"templates": [...], "total": ..., "page": ..., "pageSize": ...}
```

#### Get Specific Template
```python
template = sdk.get_template(template_id)
```

#### Create Template
```python
template = sdk.create_template({
    "name": "Custom Python",
    "language": "python",
    "version": "3.11",
    "docker_image": "python:3.11-slim",
    "install_command": "pip install -r requirements.txt",
})
```

### Metrics & Monitoring

#### Get Metrics
```python
metrics = sdk.get_metrics()
# Returns: {
#     "total_requests": int,
#     "successful_requests": int,
#     "failed_requests": int,
#     "average_response_time": float,
#     "total_execution_time": float,
#     "active_sandboxes": int,
#     "last_updated": str
# }
```

## Error Handling

The SDK provides specific exception classes for different error scenarios:

```python
from sandbox_sdk import (
    SandboxSDKError,
    ExecutionError,
    ConnectionError,
    TimeoutError,
    SandboxError,
    RateLimitError,
)

try:
    result = sdk.run_code(sandbox_id, code)
except RateLimitError as e:
    print(f"Rate limited, retry after {e.retry_after}ms")
except TimeoutError as e:
    print(f"Request timed out: {e}")
except ConnectionError as e:
    print(f"Connection failed: {e}")
except SandboxError as e:
    print(f"Sandbox error: {e}")
except ExecutionError as e:
    print(f"Execution error: {e.name}")
    print(f"Value: {e.value}")
    print(f"Traceback: {e.traceback}")
```

## Callbacks

Use callbacks for real-time output streaming:

```python
def on_stdout(message):
    print(f"STDOUT: {message.line}")

def on_stderr(message):
    print(f"STDERR: {message.line}")

def on_result(result):
    print(f"Result: {result.text}")

def on_error(error):
    print(f"Error: {error.name}")

sdk.run_code(
    sandbox_id,
    code,
    {
        "on_stdout": on_stdout,
        "on_stderr": on_stderr,
        "on_result": on_result,
        "on_error": on_error,
    }
)
```

## Logging

Enable logging for debugging:

```python
sdk = SandboxSDK({
    "api_key": "...",
    "server_url": "...",
    "enable_logging": True,
    "log_level": "debug",  # "debug", "info", "warn", "error"
})
```

## Metrics

Enable metrics collection:

```python
sdk = SandboxSDK({
    "api_key": "...",
    "server_url": "...",
    "enable_metrics": True,
    "metrics_interval": 30000,  # milliseconds
})

# Get current metrics
metrics = sdk.get_metrics()
print(metrics)
```

## Classes and Types

### Main Classes
- `SandboxSDK` - Main SDK class
- `Execution` - Execution result container
- `Result` - Individual result from execution
- `ExecutionError` - Execution error information

### Error Classes
- `SandboxSDKError` - Base error class
- `ExecutionError` - Code execution error
- `ConnectionError` - Connection error
- `TimeoutError` - Request timeout
- `SandboxError` - Sandbox-specific error
- `RateLimitError` - Rate limit exceeded

### Data Classes
- `OutputMessage` - Streaming output message
- `Logs` - Log container
- `ChartType` - Chart data structure
- `SandboxStatus` - Enum for sandbox status
- `ExecutionMetadata` - Execution metadata

## Examples

See `examples.py` for comprehensive examples including:
- Basic usage
- Callbacks and streaming
- File operations
- Batch execution
- Template management
- Context management
- Error handling
- Terminal execution

## Environment Variables

You can also configure the SDK using environment variables:

```bash
export SANDBOX_API_KEY="your-api-key"
export SANDBOX_SERVER_URL="https://api.sandbox.example.com"
export SANDBOX_TIMEOUT="60000"
export SANDBOX_LOG_LEVEL="info"
```

Then initialize without passing config:

```python
import os

config = {
    "api_key": os.getenv("SANDBOX_API_KEY"),
    "server_url": os.getenv("SANDBOX_SERVER_URL"),
    "timeout": int(os.getenv("SANDBOX_TIMEOUT", "60000")),
}

sdk = SandboxSDK(config)
```

## Rate Limiting

The SDK implements rate limiting with exponential backoff:

```python
try:
    sdk.run_code(sandbox_id, code)
except RateLimitError as e:
    time.sleep(e.retry_after / 1000)  # Convert to seconds
    sdk.run_code(sandbox_id, code)
```

## Cleanup

Always disconnect to clean up resources:

```python
try:
    # Use SDK
    pass
finally:
    sdk.disconnect()
```

Or use as context manager (if implemented):

```python
with SandboxSDK(config) as sdk:
    # Use SDK
    pass
```

## License

This is a Python port of the TypeScript Sandbox SDK.

## Support

For issues and support, please refer to the original TypeScript implementation or contact support.
