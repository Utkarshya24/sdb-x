"""
Example usage of the Sandbox SDK
"""
from sandbox_sdk import (
    SandboxSDK,
    ExecutionError,
    SandboxError,
    RateLimitError,
    TimeoutError,
    ConnectionError,
)
from types import OutputMessage


def example_basic_usage():
    """Basic usage example"""
    # Initialize the SDK
    config = {
        "api_key": "your-api-key-here",
        "server_url": "https://api.sandbox.example.com",
        "timeout": 60000,
        "enable_logging": True,
        "log_level": "info",
        "enable_metrics": True,
        "metrics_interval": 30000,
    }
    
    sdk = SandboxSDK(config)
    
    try:
        # Create a sandbox
        sandbox_response = sdk.create_sandbox({
            "template_id": "python-3.11",
            "name": "My Python Sandbox",
            "auto_start": True,
        })
        
        sandbox = sandbox_response["sandbox"]
        sandbox_id = sandbox["id"]
        print(f"Created sandbox: {sandbox_id}")
        
        # Check sandbox status
        status = sdk.get_sandbox_status(sandbox_id)
        print(f"Sandbox status: {status}")
        
        # Run some code
        result = sdk.run_code(sandbox_id, "print('Hello, World!')")
        
        print(f"Execution result: {result['execution'].text}")
        print(f"Duration: {result['metadata']['duration']}ms")
        
        # List active sandboxes
        sandboxes = sdk.list_sandboxes()
        print(f"Active sandboxes: {len(sandboxes)}")
        
        # Get metrics
        metrics = sdk.get_metrics()
        print(f"Metrics: {metrics}")
        
        # Delete sandbox
        sdk.delete_sandbox(sandbox_id)
        print("Sandbox deleted")
        
    finally:
        sdk.disconnect()


def example_with_callbacks():
    """Example with output callbacks"""
    config = {
        "api_key": "your-api-key-here",
        "server_url": "https://api.sandbox.example.com",
        "enable_logging": True,
    }
    
    sdk = SandboxSDK(config)
    
    try:
        # Create sandbox
        sandbox_response = sdk.create_sandbox({
            "template_id": "python-3.11",
            "name": "Callback Example",
        })
        sandbox_id = sandbox_response["sandbox"]["id"]
        
        # Define callbacks
        def on_stdout(msg: OutputMessage):
            print(f"[STDOUT] {msg.line}")
        
        def on_stderr(msg: OutputMessage):
            print(f"[STDERR] {msg.line}")
        
        def on_result(result):
            print(f"[RESULT] {result.text}")
        
        def on_error(error: ExecutionError):
            print(f"[ERROR] {error.name}: {error.value}")
        
        # Run code with callbacks
        code = """
import sys
print("Starting execution")
sys.stderr.write("This is stderr\\n")
result = 42
"""
        
        result = sdk.run_code(
            sandbox_id,
            code,
            {
                "on_stdout": on_stdout,
                "on_stderr": on_stderr,
                "on_result": on_result,
                "on_error": on_error,
            }
        )
        
        # Cleanup
        sdk.delete_sandbox(sandbox_id)
        
    finally:
        sdk.disconnect()


def example_file_operations():
    """Example of file operations"""
    config = {
        "api_key": "your-api-key-here",
        "server_url": "https://api.sandbox.example.com",
    }
    
    sdk = SandboxSDK(config)
    
    try:
        # Create sandbox
        sandbox_response = sdk.create_sandbox({
            "template_id": "python-3.11",
            "name": "File Operations",
        })
        sandbox_id = sandbox_response["sandbox"]["id"]
        
        # Write a file
        content = "print('Hello from file')\nresult = 'success'"
        path = sdk.write_file(sandbox_id, "/workspace/hello.py", content)
        print(f"File written to: {path}")
        
        # Read the file
        file_content = sdk.read_file(sandbox_id, "/workspace/hello.py")
        print(f"File content: {file_content}")
        
        # List files
        files = sdk.list_files(sandbox_id, "/workspace")
        print(f"Files in workspace: {files}")
        
        # Run the file
        result = sdk.run_code(sandbox_id, "exec(open('/workspace/hello.py').read())")
        print(f"Result: {result['execution'].text}")
        
        # Delete the file
        sdk.delete_file(sandbox_id, "/workspace/hello.py")
        print("File deleted")
        
        # Cleanup
        sdk.delete_sandbox(sandbox_id)
        
    finally:
        sdk.disconnect()


def example_batch_execution():
    """Example of batch execution"""
    config = {
        "api_key": "your-api-key-here",
        "server_url": "https://api.sandbox.example.com",
    }
    
    sdk = SandboxSDK(config)
    
    try:
        # Create sandbox
        sandbox_response = sdk.create_sandbox({
            "template_id": "python-3.11",
            "name": "Batch Execution",
        })
        sandbox_id = sandbox_response["sandbox"]["id"]
        
        # Define batch jobs
        jobs = [
            {
                "id": "job-1",
                "code": "print('Job 1'); 2 + 2",
                "timeout": 5000,
            },
            {
                "id": "job-2",
                "code": "print('Job 2'); 3 * 3",
                "timeout": 5000,
            },
            {
                "id": "job-3",
                "code": "print('Job 3'); [1, 2, 3, 4, 5]",
                "timeout": 5000,
            },
        ]
        
        # Execute batch
        results = sdk.execute_batch(sandbox_id, jobs)
        
        for result in results:
            print(f"Job {result['job_id']}: {result['success']} (took {result['duration']}ms)")
            if result['success']:
                print(f"  Logs: {result['execution'].logs}")
            else:
                print(f"  Error: {result['error']}")
        
        # Cleanup
        sdk.delete_sandbox(sandbox_id)
        
    finally:
        sdk.disconnect()


def example_template_management():
    """Example of template management"""
    config = {
        "api_key": "your-api-key-here",
        "server_url": "https://api.sandbox.example.com",
    }
    
    sdk = SandboxSDK(config)
    
    try:
        # Get available templates
        templates = sdk.get_templates(page=1, page_size=10)
        print(f"Available templates: {templates['total']}")
        
        for template in templates["templates"]:
            print(f"  - {template['id']}: {template['config']['language']}")
        
        # Get specific template
        if templates["templates"]:
            template_id = templates["templates"][0]["id"]
            template = sdk.get_template(template_id)
            print(f"\nTemplate details for {template_id}:")
            print(f"  Language: {template['config']['language']}")
            print(f"  Framework: {template['config'].get('framework', 'N/A')}")
        
        # Create custom template
        new_template = {
            "name": "Custom Python",
            "language": "python",
            "version": "3.11",
            "docker_image": "python:3.11-slim",
            "install_command": "pip install -r requirements.txt",
        }
        
        response = sdk.create_template(new_template)
        print(f"\nCustom template created: {response['id']}")
        
    finally:
        sdk.disconnect()


def example_context_management():
    """Example of code context management"""
    config = {
        "api_key": "your-api-key-here",
        "server_url": "https://api.sandbox.example.com",
    }
    
    sdk = SandboxSDK(config)
    
    try:
        # Create sandbox
        sandbox_response = sdk.create_sandbox({
            "template_id": "python-3.11",
            "name": "Context Example",
        })
        sandbox_id = sandbox_response["sandbox"]["id"]
        
        # Create code context
        context = sdk.create_code_context(
            sandbox_id,
            language="python",
            cwd="/workspace",
        )
        print(f"Created context: {context['id']}")
        
        # List contexts
        contexts = sdk.list_code_contexts(sandbox_id)
        print(f"Active contexts: {len(contexts)}")
        
        # Delete context
        sdk.delete_code_context(context["id"])
        print("Context deleted")
        
        # Cleanup
        sdk.delete_sandbox(sandbox_id)
        
    finally:
        sdk.disconnect()


def example_error_handling():
    """Example of error handling"""
    config = {
        "api_key": "your-api-key-here",
        "server_url": "https://api.sandbox.example.com",
    }
    
    sdk = SandboxSDK(config)
    
    try:
        # Try to access non-existent sandbox
        try:
            sdk.get_sandbox_status("non-existent-id")
        except SandboxError as e:
            print(f"Caught SandboxError: {e}")
        
        # Try invalid config
        try:
            bad_sdk = SandboxSDK({"server_url": "https://example.com"})
        except Exception as e:
            print(f"Caught config error: {e}")
        
        # Create a real sandbox for other examples
        sandbox_response = sdk.create_sandbox({
            "template_id": "python-3.11",
        })
        sandbox_id = sandbox_response["sandbox"]["id"]
        
        # Try code with execution error
        try:
            result = sdk.run_code(sandbox_id, "1/0")  # Division by zero
            if result['execution'].error:
                print(f"Execution error: {result['execution'].error.name}")
        except ExecutionError as e:
            print(f"Caught ExecutionError: {e.name}: {e.value}")
        
        # Cleanup
        sdk.delete_sandbox(sandbox_id)
        
    except RateLimitError as e:
        print(f"Rate limited, retry after {e.retry_after}ms")
    except TimeoutError as e:
        print(f"Timeout: {e}")
    except ConnectionError as e:
        print(f"Connection error: {e}")
    finally:
        sdk.disconnect()


def example_terminal_execution():
    """Example of terminal command execution"""
    config = {
        "api_key": "your-api-key-here",
        "server_url": "https://api.sandbox.example.com",
    }
    
    sdk = SandboxSDK(config)
    
    try:
        # Create sandbox
        sandbox_response = sdk.create_sandbox({
            "template_id": "python-3.11",
            "name": "Terminal Example",
        })
        sandbox_id = sandbox_response["sandbox"]["id"]
        
        # Run terminal command
        output = sdk.run_terminal(sandbox_id, "ls -la /workspace")
        print(f"Terminal output:\n{output}")
        
        # Run another command
        output = sdk.run_terminal(sandbox_id, "python --version")
        print(f"Python version:\n{output}")
        
        # Cleanup
        sdk.delete_sandbox(sandbox_id)
        
    finally:
        sdk.disconnect()


if __name__ == "__main__":
    print("=== Basic Usage ===")
    # example_basic_usage()
    
    print("\n=== With Callbacks ===")
    # example_with_callbacks()
    
    print("\n=== File Operations ===")
    # example_file_operations()
    
    print("\n=== Batch Execution ===")
    # example_batch_execution()
    
    print("\n=== Template Management ===")
    # example_template_management()
    
    print("\n=== Context Management ===")
    # example_context_management()
    
    print("\n=== Error Handling ===")
    # example_error_handling()
    
    print("\n=== Terminal Execution ===")
    # example_terminal_execution()
    
    print("\nNote: Uncomment the examples you want to run in the main block")
