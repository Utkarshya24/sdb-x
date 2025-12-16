"""
Type definitions for Sandbox SDK
"""
from typing import Dict, List, Any, Optional, Callable
from enum import Enum
from dataclasses import dataclass
from datetime import datetime


# ============ Chart and Log Types ============

@dataclass
class ChartType:
    """Chart type definition"""
    type: str
    title: str
    elements: List[Any]


@dataclass
class Logs:
    """Log container for stdout and stderr"""
    stdout: List[str]
    stderr: List[str]


@dataclass
class OutputMessage:
    """Output message for streaming"""
    line: str
    timestamp: int
    error: bool


@dataclass
class RawData:
    """Raw data from API response"""
    data: Dict[str, Any]
    
    def __getitem__(self, key):
        return self.data.get(key)
    
    def __setitem__(self, key, value):
        self.data[key] = value
    
    def get(self, key, default=None):
        return self.data.get(key, default)
    
    def keys(self):
        return self.data.keys()
    
    def items(self):
        return self.data.items()


# ============ Template Types ============

@dataclass
class TemplateConfig:
    """Template configuration"""
    name: str
    language: str
    version: str
    docker_image: str
    framework: Optional[str] = None
    dependencies: Optional[List[str]] = None
    install_command: Optional[str] = None
    start_command: Optional[str] = None
    default_env_vars: Optional[Dict[str, str]] = None
    timeout_ms: Optional[int] = None
    max_instances: Optional[int] = None


@dataclass
class SandboxTemplate:
    """Sandbox template"""
    id: str
    config: TemplateConfig
    created_at: datetime
    updated_at: datetime
    is_public: bool
    author_id: Optional[str] = None


# ============ Sandbox Types ============

class SandboxStatus(str, Enum):
    """Sandbox status enum"""
    CREATING = "creating"
    READY = "ready"
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"
    TERMINATED = "terminated"


@dataclass
class SandboxConfig:
    """Sandbox configuration"""
    id: str
    user_id: str
    template_id: str
    template_config: TemplateConfig
    status: SandboxStatus
    created_at: datetime
    updated_at: datetime
    container_id: Optional[str] = None
    port: Optional[int] = None
    exposed_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class SandboxEnvironment:
    """Sandbox environment variables and port mapping"""
    sandbox_id: str
    variables: Dict[str, str]
    ports: Dict[int, int]  # internal -> external


# ============ Context Types ============

@dataclass
class CodeContext:
    """Code execution context"""
    id: str
    sandbox_id: str
    language: str
    cwd: str
    created_at: datetime


# ============ Execution Types ============

@dataclass
class ExecutionMetadata:
    """Metadata about code execution"""
    execution_id: str
    sandbox_id: str
    start_time: datetime
    context_id: Optional[str] = None
    end_time: Optional[datetime] = None
    duration: Optional[float] = None
    exit_code: Optional[int] = None


@dataclass
class ExecutionResult:
    """Result from code execution"""
    execution: 'Execution'
    metadata: ExecutionMetadata
    timestamp: int


# ============ Options Types ============

@dataclass
class RunCodeOptions:
    """Options for running code"""
    on_stdout: Optional[Callable[[OutputMessage], None]] = None
    on_stderr: Optional[Callable[[OutputMessage], None]] = None
    on_result: Optional[Callable[['Result'], None]] = None
    on_error: Optional[Callable[['ExecutionError'], None]] = None
    envs: Optional[Dict[str, str]] = None
    timeout_ms: Optional[int] = None
    request_timeout_ms: Optional[int] = None
    capture_output: Optional[bool] = None
    max_output_size: Optional[int] = None  # bytes


@dataclass
class CreateSandboxOptions:
    """Options for creating a sandbox"""
    template_id: str
    name: Optional[str] = None
    expiry_time: Optional[int] = None  # milliseconds
    initial_env_vars: Optional[Dict[str, str]] = None
    metadata: Optional[Dict[str, Any]] = None
    auto_start: Optional[bool] = None


@dataclass
class CreateContextOptions:
    """Options for creating a code context"""
    sandbox_id: str
    cwd: Optional[str] = None
    language: Optional[str] = None
    request_timeout_ms: Optional[int] = None


@dataclass
class FileOperationOptions:
    """Options for file operations"""
    sandbox_id: str
    path: str
    encoding: Optional[str] = None
    create_parents: Optional[bool] = None


# ============ Response Types ============

@dataclass
class SandboxCreationResponse:
    """Response from sandbox creation"""
    sandbox: SandboxConfig
    connection_string: Optional[str] = None
    credentials: Optional[Dict[str, Any]] = None


@dataclass
class TemplateListResponse:
    """Response from template list"""
    templates: List[SandboxTemplate]
    total: int
    page: int
    page_size: int


@dataclass
class FileInfo:
    """Information about a file"""
    path: str
    is_directory: bool
    size: int
    created_at: datetime
    modified_at: datetime


@dataclass
class FileListResponse:
    """Response from file list"""
    files: List[FileInfo]
    directory: str


@dataclass
class ErrorResponse:
    """API error response"""
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: Optional[int] = None


# ============ Batch Execution Types ============

@dataclass
class BatchExecutionJob:
    """Job for batch execution"""
    id: str
    code: str
    language: Optional[str] = None
    timeout: Optional[int] = None
    priority: Optional[int] = None  # 1-10, higher = more important


@dataclass
class BatchExecutionResult:
    """Result from batch execution"""
    job_id: str
    success: bool
    duration: float
    execution: Optional['Execution'] = None
    error: Optional[str] = None


# ============ SDK Configuration ============

@dataclass
class SandboxSDKConfig:
    """SDK configuration"""
    api_key: str
    server_url: str
    timeout: Optional[int] = None
    max_retries: Optional[int] = None
    retry_delay: Optional[int] = None
    enable_logging: Optional[bool] = None
    log_level: Optional[str] = None  # "debug" | "info" | "warn" | "error"
    enable_metrics: Optional[bool] = None
    metrics_interval: Optional[int] = None  # milliseconds


# ============ Execution Types (for forward references) ============

@dataclass
class Execution:
    """Code execution result container"""
    results: List['Result']
    logs: Logs
    error: Optional['ExecutionError'] = None
    execution_count: Optional[int] = None


@dataclass
class Result:
    """Result from code execution"""
    is_main_result: bool
    text: Optional[str] = None
    html: Optional[str] = None
    markdown: Optional[str] = None
    svg: Optional[str] = None
    png: Optional[str] = None
    jpeg: Optional[str] = None
    pdf: Optional[str] = None
    latex: Optional[str] = None
    json: Optional[str] = None
    javascript: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    chart: Optional[ChartType] = None
    extra: Optional[Dict[str, Any]] = None
    raw: Optional[Dict[str, Any]] = None


@dataclass
class ExecutionError:
    """Execution error information"""
    name: str
    value: str
    traceback: str


# ============ Rate Limiting Types ============

@dataclass
class RateLimitConfig:
    """Rate limiting configuration"""
    max_requests_per_minute: Optional[int] = None
    max_concurrent_jobs: Optional[int] = None
    max_sandboxes_per_user: Optional[int] = None
    max_storage_per_sandbox: Optional[int] = None  # bytes


@dataclass
class RateLimitInfo:
    """Rate limit information"""
    remaining: int
    limit: int
    reset_at: datetime
