import uuid
import json
import requests
import time
import logging
from datetime import datetime
from typing import Optional, Dict, List, Any, Callable, Map
from enum import Enum
from dataclasses import dataclass, field, asdict
from threading import Timer

# ============ Custom Errors ============

class SandboxSDKError(Exception):
    """Base error for Sandbox SDK"""
    def __init__(self, message: str):
        super().__init__(message)
        self.name = "SandboxSDKError"


class ExecutionError(Exception):
    """Execution error with traceback information"""
    def __init__(self, name: str, value: str, traceback: str):
        self.name = name
        self.value = value
        self.traceback = traceback
        super().__init__(value)


class ConnectionError(SandboxSDKError):
    """Connection error"""
    def __init__(self, message: str):
        super().__init__(message)
        self.name = "ConnectionError"


class TimeoutError(SandboxSDKError):
    """Timeout error"""
    def __init__(self, message: str):
        super().__init__(message)
        self.name = "TimeoutError"


class SandboxError(SandboxSDKError):
    """Sandbox-specific error"""
    def __init__(self, message: str):
        super().__init__(message)
        self.name = "SandboxError"


class RateLimitError(SandboxSDKError):
    """Rate limit exceeded error"""
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__(f"Rate limit exceeded. Retry after {retry_after}ms")
        self.name = "RateLimitError"


# ============ Data Classes ============

@dataclass
class ChartType:
    """Chart type definition"""
    type: str
    title: str
    elements: List[Any]


@dataclass
class Logs:
    """Log container"""
    stdout: List[str] = field(default_factory=list)
    stderr: List[str] = field(default_factory=list)


@dataclass
class OutputMessage:
    """Output message for streaming"""
    line: str
    timestamp: int
    error: bool


class Result:
    """Result from code execution"""
    
    def __init__(self, raw_data: Dict[str, Any], is_main_result: bool = False):
        self.is_main_result = is_main_result
        self.raw = raw_data.copy()
        
        # Extract standard result types
        self.text = raw_data.get("text")
        self.html = raw_data.get("html")
        self.markdown = raw_data.get("markdown")
        self.svg = raw_data.get("svg")
        self.png = raw_data.get("png")
        self.jpeg = raw_data.get("jpeg")
        self.pdf = raw_data.get("pdf")
        self.latex = raw_data.get("latex")
        self.json = raw_data.get("json")
        self.javascript = raw_data.get("javascript")
        self.data = raw_data.get("data")
        self.chart = raw_data.get("chart")
        
        # Store extra fields
        self.extra = {}
        reserved_keys = {
            "text", "html", "markdown", "svg", "png", "jpeg", "pdf", "latex",
            "json", "javascript", "data", "chart", "type", "is_main_result",
        }
        
        for key, value in raw_data.items():
            if key not in reserved_keys:
                self.extra[key] = value
    
    def formats(self) -> List[str]:
        """Get available formats for this result"""
        formats = []
        if self.text:
            formats.append("text")
        if self.html:
            formats.append("html")
        if self.markdown:
            formats.append("markdown")
        if self.svg:
            formats.append("svg")
        if self.png:
            formats.append("png")
        if self.jpeg:
            formats.append("jpeg")
        if self.pdf:
            formats.append("pdf")
        if self.latex:
            formats.append("latex")
        if self.json:
            formats.append("json")
        if self.javascript:
            formats.append("javascript")
        if self.data:
            formats.append("data")
        if self.chart:
            formats.append("chart")
        formats.extend(self.extra.keys())
        return formats
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary"""
        result_dict = {
            "text": self.text,
            "html": self.html,
            "markdown": self.markdown,
            "svg": self.svg,
            "png": self.png,
            "jpeg": self.jpeg,
            "pdf": self.pdf,
            "latex": self.latex,
            "json": self.json,
            "javascript": self.javascript,
        }
        if self.extra:
            result_dict["extra"] = self.extra
        return result_dict


class Execution:
    """Code execution result container"""
    
    def __init__(
        self,
        results: Optional[List[Result]] = None,
        logs: Optional[Logs] = None,
        error: Optional[ExecutionError] = None,
        execution_count: Optional[int] = None
    ):
        self.results = results or []
        self.logs = logs or Logs()
        self.error = error
        self.execution_count = execution_count
    
    @property
    def text(self) -> Optional[str]:
        """Get main result text"""
        for result in self.results:
            if result.is_main_result and result.text:
                return result.text
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert execution to dictionary"""
        return {
            "results": [r.to_dict() for r in self.results],
            "logs": asdict(self.logs),
            "error": {
                "name": self.error.name,
                "value": self.error.value,
                "traceback": self.error.traceback,
            } if self.error else None,
        }


# ============ Metrics Collector ============

@dataclass
class MetricsData:
    """Metrics data container"""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    average_response_time: float = 0.0
    total_execution_time: float = 0.0
    active_sandboxes: int = 0
    last_updated: datetime = field(default_factory=datetime.now)


class MetricsCollector:
    """Collects and manages metrics"""
    
    def __init__(self):
        self.metrics = MetricsData()
        self.response_times = []
    
    def record_request(self, success: bool, response_time: float) -> None:
        """Record a request and its response time"""
        self.metrics.total_requests += 1
        if success:
            self.metrics.successful_requests += 1
        else:
            self.metrics.failed_requests += 1
        
        self.response_times.append(response_time)
        if len(self.response_times) > 1000:
            self.response_times.pop(0)
        
        self._update_average_response_time()
    
    def _update_average_response_time(self) -> None:
        """Update average response time"""
        if not self.response_times:
            return
        self.metrics.average_response_time = sum(self.response_times) / len(self.response_times)
    
    def record_execution(self, duration: float) -> None:
        """Record execution duration"""
        self.metrics.total_execution_time += duration
    
    def update_active_sandboxes(self, count: int) -> None:
        """Update active sandbox count"""
        self.metrics.active_sandboxes = count
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        return {
            "total_requests": self.metrics.total_requests,
            "successful_requests": self.metrics.successful_requests,
            "failed_requests": self.metrics.failed_requests,
            "average_response_time": self.metrics.average_response_time,
            "total_execution_time": self.metrics.total_execution_time,
            "active_sandboxes": self.metrics.active_sandboxes,
            "last_updated": datetime.now().isoformat(),
        }
    
    def reset(self) -> None:
        """Reset metrics"""
        self.metrics = MetricsData()
        self.response_times = []


# ============ Rate Limiter ============

class RateLimiter:
    """Rate limiting for requests"""
    
    def __init__(self, max_requests_per_minute: int = 60):
        self.max_requests_per_minute = max_requests_per_minute
        self.request_timestamps = []
        self.concurrent_jobs = 0
    
    def can_make_request(self) -> bool:
        """Check if request can be made"""
        now = time.time() * 1000  # milliseconds
        one_minute_ago = now - 60000
        self.request_timestamps = [ts for ts in self.request_timestamps if ts > one_minute_ago]
        return len(self.request_timestamps) < self.max_requests_per_minute
    
    def record_request(self) -> None:
        """Record a request"""
        self.request_timestamps.append(time.time() * 1000)
    
    def get_retry_after(self) -> int:
        """Get milliseconds to wait before retry"""
        if not self.request_timestamps:
            return 0
        oldest_timestamp = self.request_timestamps[0]
        retry_after = 60000 - (time.time() * 1000 - oldest_timestamp)
        return max(int(retry_after), 0)
    
    def increment_concurrent_jobs(self) -> int:
        """Increment concurrent job count"""
        self.concurrent_jobs += 1
        return self.concurrent_jobs
    
    def decrement_concurrent_jobs(self) -> int:
        """Decrement concurrent job count"""
        self.concurrent_jobs = max(self.concurrent_jobs - 1, 0)
        return self.concurrent_jobs
    
    def get_concurrent_jobs(self) -> int:
        """Get current concurrent job count"""
        return self.concurrent_jobs


# ============ Main SDK Class ============

class SandboxSDK:
    """Main Sandbox SDK class"""
    
    def __init__(self, config: Dict[str, Any]):
        if not config.get("api_key") or not isinstance(config.get("api_key"), str):
            raise SandboxSDKError("Invalid API key provided")
        
        if not config.get("server_url") or not isinstance(config.get("server_url"), str):
            raise SandboxSDKError("Invalid server URL provided")
        
        self.config = {
            "api_key": config["api_key"],
            "server_url": config["server_url"],
            "timeout": config.get("timeout", 60000),
            "max_retries": config.get("max_retries", 3),
            "retry_delay": config.get("retry_delay", 1000),
            "enable_logging": config.get("enable_logging", False),
            "log_level": config.get("log_level", "info"),
            "enable_metrics": config.get("enable_metrics", False),
            "metrics_interval": config.get("metrics_interval", 30000),
        }
        
        self.active_sandboxes = {}
        self.active_contexts = {}
        self.metrics_collector = MetricsCollector()
        self.rate_limiter = RateLimiter(60)
        self.metrics_interval = None
        self.logger = self._setup_logger()
        
        self._setup_metrics_collection()
    
    def _setup_logger(self) -> logging.Logger:
        """Setup logger"""
        logger = logging.getLogger("SandboxSDK")
        level_map = {
            "debug": logging.DEBUG,
            "info": logging.INFO,
            "warn": logging.WARNING,
            "error": logging.ERROR,
        }
        logger.setLevel(level_map.get(self.config["log_level"], logging.INFO))
        return logger
    
    def _log(self, level: str, message: str) -> None:
        """Log message"""
        if not self.config["enable_logging"]:
            return
        
        levels = ["debug", "info", "warn", "error"]
        current_level_index = levels.index(self.config["log_level"])
        message_level_index = levels.index(level) if level in levels else 1
        
        if message_level_index >= current_level_index:
            log_method = getattr(self.logger, level, self.logger.info)
            log_method(message)
    
    # ============ HTTP Request Helper ============
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        payload: Optional[Dict[str, Any]] = None,
        timeout_ms: Optional[int] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to server"""
        url = f"{self.config['server_url']}{endpoint}"
        timeout = (timeout_ms or self.config["timeout"]) / 1000  # Convert to seconds
        start_time = time.time()
        
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.config['api_key']}",
            }
            
            response = requests.request(
                method,
                url,
                json=payload,
                headers=headers,
                timeout=timeout
            )
            
            response.raise_for_status()
            data = response.json()
            
            response_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            self.metrics_collector.record_request(True, response_time)
            
            return data
        
        except requests.exceptions.Timeout:
            self.metrics_collector.record_request(False, (time.time() - start_time) * 1000)
            raise TimeoutError(f"Request timeout after {timeout_ms}ms")
        
        except requests.exceptions.RequestException as e:
            self.metrics_collector.record_request(False, (time.time() - start_time) * 1000)
            try:
                error_data = e.response.json()
                raise SandboxError(error_data.get("message", f"Request failed with status {e.response.status_code}"))
            except:
                raise SandboxError(str(e))
    
    # ============ Sandbox Management ============
    
    def create_sandbox(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new sandbox"""
        self._check_rate_limit()
        
        response = self._make_request(
            "POST",
            "/api/sandboxes/create",
            options,
            self.config["timeout"]
        )
        
        sandbox = response.get("sandbox")
        if sandbox:
            self.active_sandboxes[sandbox["id"]] = sandbox
        
        return response
    
    def delete_sandbox(self, sandbox_id: str) -> None:
        """Delete a sandbox"""
        for context_id in list(self.active_contexts.keys()):
            context = self.active_contexts[context_id]
            if context.get("sandbox_id") == sandbox_id:
                del self.active_contexts[context_id]
        
        if sandbox_id in self.active_sandboxes:
            del self.active_sandboxes[sandbox_id]
        
        self._make_request("DELETE", f"/api/sandboxes/{sandbox_id}", None)
    
    def get_sandbox_status(self, sandbox_id: str) -> str:
        """Get sandbox status"""
        if sandbox_id not in self.active_sandboxes:
            raise SandboxError(f"Sandbox {sandbox_id} not found")
        
        response = self._make_request(
            "GET",
            f"/api/sandboxes/{sandbox_id}/status",
            None
        )
        
        status = response.get("status")
        self.active_sandboxes[sandbox_id]["status"] = status
        return status
    
    def list_sandboxes(self) -> List[Dict[str, Any]]:
        """List all active sandboxes"""
        return list(self.active_sandboxes.values())
    
    # ============ Template Management ============
    
    def get_templates(self, page: int = 1, page_size: int = 10) -> Dict[str, Any]:
        """Get templates with pagination"""
        return self._make_request(
            "GET",
            f"/api/templates?page={page}&pageSize={page_size}",
            None
        )
    
    def get_template(self, template_id: str) -> Dict[str, Any]:
        """Get a specific template"""
        return self._make_request(
            "GET",
            f"/api/templates/{template_id}",
            None
        )
    
    def create_template(self, template: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new template"""
        return self._make_request(
            "POST",
            "/api/templates",
            template
        )
    
    # ============ Code Execution ============
    
    def run_code(
        self,
        sandbox_id: str,
        code: str,
        opts: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Run code in a sandbox"""
        self._check_rate_limit()
        
        if sandbox_id not in self.active_sandboxes:
            raise SandboxError(f"Sandbox {sandbox_id} not found")
        
        sandbox = self.active_sandboxes[sandbox_id]
        opts = opts or {}
        
        payload = {
            "code": code,
            "language": sandbox.get("template_config", {}).get("language"),
            "envVars": opts.get("envs"),
        }
        
        start_time = time.time()
        result = self._make_request(
            "POST",
            f"/api/sandboxes/{sandbox_id}/execute",
            payload,
            opts.get("timeout_ms")
        )
        
        execution = Execution()
        execution.logs = Logs(
            stdout=result.get("logs", {}).get("stdout", []),
            stderr=result.get("logs", {}).get("stderr", [])
        )
        
        if result.get("results"):
            execution.results = [
                Result(r, r.get("is_main_result", False))
                for r in result["results"]
            ]
        
        if result.get("error"):
            error_data = result["error"]
            execution.error = ExecutionError(
                error_data.get("name"),
                error_data.get("value"),
                error_data.get("traceback")
            )
        
        execution.execution_count = result.get("execution_count")
        
        # Handle callbacks
        if opts.get("on_result") and execution.results:
            for res in execution.results:
                opts["on_result"](res)
        
        if opts.get("on_stdout") and execution.logs.stdout:
            for line in execution.logs.stdout:
                opts["on_stdout"](OutputMessage(
                    line=line,
                    timestamp=int(time.time() * 1000000),
                    error=False
                ))
        
        if opts.get("on_stderr") and execution.logs.stderr:
            for line in execution.logs.stderr:
                opts["on_stderr"](OutputMessage(
                    line=line,
                    timestamp=int(time.time() * 1000000),
                    error=True
                ))
        
        if opts.get("on_error") and execution.error:
            opts["on_error"](execution.error)
        
        return {
            "execution": execution,
            "metadata": {
                "execution_id": str(uuid.uuid4()),
                "sandbox_id": sandbox_id,
                "start_time": datetime.fromtimestamp(start_time),
                "end_time": datetime.now(),
                "duration": (time.time() - start_time) * 1000,
            },
            "timestamp": int(time.time() * 1000),
        }
    
    def run_terminal(
        self,
        sandbox_id: str,
        command: str,
        opts: Optional[Dict[str, Any]] = None
    ) -> str:
        """Run terminal command in a sandbox"""
        self._check_rate_limit()
        
        if sandbox_id not in self.active_sandboxes:
            raise SandboxError(f"Sandbox {sandbox_id} not found")
        
        opts = opts or {}
        payload = {"command": command}
        
        result = self._make_request(
            "POST",
            f"/api/sandboxes/{sandbox_id}/terminal",
            payload,
            opts.get("timeout_ms")
        )
        
        output = result.get("output", "")
        
        if opts.get("on_stdout"):
            opts["on_stdout"](OutputMessage(
                line=output,
                timestamp=int(time.time() * 1000000),
                error=False
            ))
        
        return output
    
    # ============ File Management ============
    
    def read_file(self, sandbox_id: str, path: str) -> str:
        """Read file from sandbox"""
        if sandbox_id not in self.active_sandboxes:
            raise SandboxError(f"Sandbox {sandbox_id} not found")
        
        result = self._make_request(
            "GET",
            f"/api/sandboxes/{sandbox_id}/files?path={path}",
            None
        )
        
        return result.get("content", "")
    
    def write_file(self, sandbox_id: str, path: str, content: str, create_parents: bool = True) -> str:
        """Write file to sandbox"""
        if sandbox_id not in self.active_sandboxes:
            raise SandboxError(f"Sandbox {sandbox_id} not found")
        
        payload = {
            "content": content,
            "createParents": create_parents,
        }
        
        result = self._make_request(
            "POST",
            f"/api/sandboxes/{sandbox_id}/files?path={path}",
            payload
        )
        
        return result.get("path", "")
    
    def delete_file(self, sandbox_id: str, path: str) -> None:
        """Delete file from sandbox"""
        if sandbox_id not in self.active_sandboxes:
            raise SandboxError(f"Sandbox {sandbox_id} not found")
        
        self._make_request(
            "DELETE",
            f"/api/sandboxes/{sandbox_id}/files?path={path}",
            None
        )
    
    def list_files(self, sandbox_id: str, dir_path: str = ".") -> Dict[str, Any]:
        """List files in sandbox directory"""
        if sandbox_id not in self.active_sandboxes:
            raise SandboxError(f"Sandbox {sandbox_id} not found")
        
        return self._make_request(
            "GET",
            f"/api/sandboxes/{sandbox_id}/files/list?path={dir_path}",
            None
        )
    
    # ============ Context Management ============
    
    def create_code_context(
        self,
        sandbox_id: str,
        language: Optional[str] = None,
        cwd: Optional[str] = None,
        request_timeout_ms: Optional[int] = None
    ) -> Dict[str, Any]:
        """Create a code execution context"""
        if sandbox_id not in self.active_sandboxes:
            raise SandboxError(f"Sandbox {sandbox_id} not found")
        
        sandbox = self.active_sandboxes[sandbox_id]
        payload = {
            "language": language or sandbox.get("template_config", {}).get("language"),
            "cwd": cwd or "/workspace",
        }
        
        context = self._make_request(
            "POST",
            f"/api/sandboxes/{sandbox_id}/contexts",
            payload,
            request_timeout_ms
        )
        
        self.active_contexts[context["id"]] = context
        return context
    
    def delete_code_context(self, context_id: str) -> None:
        """Delete a code context"""
        if context_id not in self.active_contexts:
            return
        
        context = self.active_contexts[context_id]
        sandbox_id = context.get("sandbox_id")
        
        del self.active_contexts[context_id]
        
        if sandbox_id:
            self._make_request(
                "DELETE",
                f"/api/sandboxes/{sandbox_id}/contexts/{context_id}",
                None
            )
    
    def list_code_contexts(self, sandbox_id: str) -> List[Dict[str, Any]]:
        """List all contexts for a sandbox"""
        return [
            ctx for ctx in self.active_contexts.values()
            if ctx.get("sandbox_id") == sandbox_id
        ]
    
    # ============ Batch Operations ============
    
    def execute_batch(
        self,
        sandbox_id: str,
        jobs: List[Dict[str, Any]],
        opts: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Execute multiple jobs in batch"""
        if sandbox_id not in self.active_sandboxes:
            raise SandboxError(f"Sandbox {sandbox_id} not found")
        
        opts = opts or {}
        results = []
        
        for job in jobs:
            start_time = time.time()
            try:
                execution = self.run_code(
                    sandbox_id,
                    job.get("code"),
                    {
                        **opts,
                        "timeout_ms": job.get("timeout"),
                    }
                )
                
                results.append({
                    "job_id": job.get("id"),
                    "success": True,
                    "execution": execution.get("execution"),
                    "duration": (time.time() - start_time) * 1000,
                })
            except Exception as e:
                results.append({
                    "job_id": job.get("id"),
                    "success": False,
                    "error": str(e),
                    "duration": (time.time() - start_time) * 1000,
                })
        
        return results
    
    # ============ Metrics & Monitoring ============
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        return self.metrics_collector.get_metrics()
    
    def _setup_metrics_collection(self) -> None:
        """Setup periodic metrics collection"""
        if not self.config["enable_metrics"]:
            return
        
        def collect_metrics():
            metrics = self.get_metrics()
            self._log("debug", f"[Metrics] {json.dumps(metrics)}")
            self.metrics_interval = Timer(
                self.config["metrics_interval"] / 1000,
                collect_metrics
            )
            self.metrics_interval.daemon = True
            self.metrics_interval.start()
        
        self.metrics_interval = Timer(
            self.config["metrics_interval"] / 1000,
            collect_metrics
        )
        self.metrics_interval.daemon = True
        self.metrics_interval.start()
    
    # ============ Private Helper Methods ============
    
    def _check_rate_limit(self) -> None:
        """Check rate limit and raise error if exceeded"""
        if not self.rate_limiter.can_make_request():
            retry_after = self.rate_limiter.get_retry_after()
            raise RateLimitError(retry_after)
        self.rate_limiter.record_request()
    
    def disconnect(self) -> None:
        """Disconnect and cleanup resources"""
        if self.metrics_interval:
            self.metrics_interval.cancel()
