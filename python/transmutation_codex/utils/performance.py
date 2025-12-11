"""Performance monitoring utilities for the Transmutation Codex.

This module provides tools for measuring and monitoring performance
of document conversion operations, including timing, memory usage,
and system resource tracking.
"""

import threading
import time
from collections.abc import Callable
from contextlib import contextmanager
from dataclasses import dataclass, field
from functools import wraps
from typing import Any

import psutil


@dataclass
class PerformanceMetrics:
    """Container for performance metrics."""

    operation_name: str
    start_time: float
    end_time: float | None = None
    duration: float | None = None
    memory_usage_mb: float | None = None
    cpu_usage_percent: float | None = None
    disk_io_read_mb: float | None = None
    disk_io_write_mb: float | None = None
    file_size_mb: float | None = None
    throughput_mbps: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if self.end_time and not self.duration:
            self.duration = self.end_time - self.start_time

        if self.duration and self.file_size_mb:
            self.throughput_mbps = (
                self.file_size_mb / self.duration if self.duration > 0 else 0
            )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "operation_name": self.operation_name,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration": self.duration,
            "memory_usage_mb": self.memory_usage_mb,
            "cpu_usage_percent": self.cpu_usage_percent,
            "disk_io_read_mb": self.disk_io_read_mb,
            "disk_io_write_mb": self.disk_io_write_mb,
            "file_size_mb": self.file_size_mb,
            "throughput_mbps": self.throughput_mbps,
            "metadata": self.metadata,
        }


class PerformanceMonitor:
    """Performance monitoring system for tracking operation metrics.

    This class provides comprehensive performance monitoring including
    timing, memory usage, CPU usage, and disk I/O tracking.
    """

    def __init__(self):
        """Initialize the performance monitor."""
        self._metrics: dict[str, PerformanceMetrics] = {}
        self._active_operations: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()
        self._process = psutil.Process()

    def start_timing(
        self, operation_name: str, file_size_mb: float | None = None, **metadata
    ) -> str:
        """Start timing an operation.

        Args:
            operation_name: Name of the operation
            file_size_mb: Size of file being processed (for throughput calculation)
            **metadata: Additional metadata to store

        Returns:
            Operation ID for tracking
        """
        operation_id = f"{operation_name}_{int(time.time() * 1000000)}"

        with self._lock:
            # Get initial system metrics
            initial_cpu = self._process.cpu_percent()
            initial_memory = self._process.memory_info().rss / (1024 * 1024)  # MB
            initial_io = self._process.io_counters()

            self._active_operations[operation_id] = {
                "start_time": time.time(),
                "initial_cpu": initial_cpu,
                "initial_memory": initial_memory,
                "initial_io_read": initial_io.read_bytes / (1024 * 1024),  # MB
                "initial_io_write": initial_io.write_bytes / (1024 * 1024),  # MB
                "file_size_mb": file_size_mb,
                "metadata": metadata,
            }

        return operation_id

    def end_timing(self, operation_id: str) -> PerformanceMetrics | None:
        """End timing for an operation and return metrics.

        Args:
            operation_id: Operation ID from start_timing

        Returns:
            PerformanceMetrics if operation was found, None otherwise
        """
        with self._lock:
            if operation_id not in self._active_operations:
                return None

            op_data = self._active_operations.pop(operation_id)
            end_time = time.time()

            # Calculate final metrics
            try:
                final_cpu = self._process.cpu_percent()
                final_memory = self._process.memory_info().rss / (1024 * 1024)  # MB
                final_io = self._process.io_counters()

                metrics = PerformanceMetrics(
                    operation_name=operation_id.rsplit("_", 1)[0],
                    start_time=op_data["start_time"],
                    end_time=end_time,
                    duration=end_time - op_data["start_time"],
                    memory_usage_mb=final_memory - op_data["initial_memory"],
                    cpu_usage_percent=(final_cpu + op_data["initial_cpu"]) / 2,
                    disk_io_read_mb=final_io.read_bytes / (1024 * 1024)
                    - op_data["initial_io_read"],
                    disk_io_write_mb=final_io.write_bytes / (1024 * 1024)
                    - op_data["initial_io_write"],
                    file_size_mb=op_data.get("file_size_mb"),
                    metadata=op_data.get("metadata", {}),
                )

                self._metrics[operation_id] = metrics
                return metrics

            except Exception:
                # Fallback to basic timing if system metrics fail
                metrics = PerformanceMetrics(
                    operation_name=operation_id.rsplit("_", 1)[0],
                    start_time=op_data["start_time"],
                    end_time=end_time,
                    duration=end_time - op_data["start_time"],
                    file_size_mb=op_data.get("file_size_mb"),
                    metadata=op_data.get("metadata", {}),
                )

                self._metrics[operation_id] = metrics
                return metrics

    def get_system_metrics(self) -> dict[str, Any]:
        """Get current system performance metrics.

        Returns:
            Dictionary with system metrics
        """
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk_usage = psutil.disk_usage("/")

            return {
                "cpu_usage_percent": cpu_percent,
                "memory_total_gb": round(memory.total / (1024**3), 2),
                "memory_available_gb": round(memory.available / (1024**3), 2),
                "memory_usage_percent": memory.percent,
                "disk_total_gb": round(disk_usage.total / (1024**3), 2),
                "disk_free_gb": round(disk_usage.free / (1024**3), 2),
                "disk_usage_percent": round(
                    (disk_usage.used / disk_usage.total) * 100, 2
                ),
            }
        except Exception:
            return {"error": "Unable to retrieve system metrics"}

    def get_process_metrics(self) -> dict[str, Any]:
        """Get current process performance metrics.

        Returns:
            Dictionary with process metrics
        """
        try:
            memory_info = self._process.memory_info()
            cpu_percent = self._process.cpu_percent()

            return {
                "process_memory_mb": round(memory_info.rss / (1024 * 1024), 2),
                "process_cpu_percent": cpu_percent,
                "thread_count": self._process.num_threads(),
                "process_status": self._process.status(),
            }
        except Exception:
            return {"error": "Unable to retrieve process metrics"}

    def get_metrics_summary(self, operation_name: str | None = None) -> dict[str, Any]:
        """Get summary statistics for recorded metrics.

        Args:
            operation_name: Optional filter by operation name

        Returns:
            Dictionary with summary statistics
        """
        with self._lock:
            metrics_list = list(self._metrics.values())

            if operation_name:
                metrics_list = [
                    m for m in metrics_list if m.operation_name == operation_name
                ]

            if not metrics_list:
                return {"error": "No metrics found"}

            durations = [m.duration for m in metrics_list if m.duration is not None]
            memory_usage = [
                m.memory_usage_mb for m in metrics_list if m.memory_usage_mb is not None
            ]
            throughputs = [
                m.throughput_mbps for m in metrics_list if m.throughput_mbps is not None
            ]

            summary = {
                "total_operations": len(metrics_list),
                "operation_name_filter": operation_name,
                "duration_stats": self._calculate_stats(durations, "seconds"),
                "memory_stats": self._calculate_stats(memory_usage, "MB"),
                "throughput_stats": self._calculate_stats(throughputs, "MB/s"),
                "metrics": [
                    m.to_dict() for m in metrics_list[-10:]
                ],  # Last 10 operations
            }

            return summary

    def _calculate_stats(self, values: list[float], unit: str) -> dict[str, Any]:
        """Calculate statistical summary for a list of values."""
        if not values:
            return {"unit": unit, "count": 0}

        return {
            "unit": unit,
            "count": len(values),
            "min": round(min(values), 3),
            "max": round(max(values), 3),
            "avg": round(sum(values) / len(values), 3),
            "total": round(sum(values), 3),
        }

    def clear_metrics(self, older_than_hours: float = 24.0) -> int:
        """Clear old metrics.

        Args:
            older_than_hours: Clear metrics older than this many hours

        Returns:
            Number of metrics cleared
        """
        cutoff_time = time.time() - (older_than_hours * 3600)
        cleared_count = 0

        with self._lock:
            to_remove = []

            for op_id, metrics in self._metrics.items():
                if metrics.start_time < cutoff_time:
                    to_remove.append(op_id)

            for op_id in to_remove:
                del self._metrics[op_id]
                cleared_count += 1

        return cleared_count

    @contextmanager
    def measure_operation(
        self, operation_name: str, file_size_mb: float | None = None, **metadata
    ):
        """Context manager for measuring operation performance.

        Args:
            operation_name: Name of the operation
            file_size_mb: Size of file being processed
            **metadata: Additional metadata

        Yields:
            PerformanceMetrics object (populated after operation completes)
        """
        operation_id = self.start_timing(operation_name, file_size_mb, **metadata)
        metrics_container = {"metrics": None}

        try:
            yield metrics_container
        finally:
            metrics = self.end_timing(operation_id)
            metrics_container["metrics"] = metrics


# Global performance monitor instance
_global_monitor = PerformanceMonitor()


def get_performance_monitor() -> PerformanceMonitor:
    """Get the global performance monitor instance."""
    return _global_monitor


def measure_performance(operation_name: str, include_file_size: bool = False):
    """Decorator for measuring function performance.

    Args:
        operation_name: Name of the operation
        include_file_size: Whether to try to extract file size from arguments

    Example:
        @measure_performance("pdf_conversion")
        def convert_pdf(input_path, output_path):
            # conversion logic
            pass
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            file_size_mb = None

            # Try to extract file size if requested
            if include_file_size and args:
                try:
                    import os

                    file_path = str(args[0])  # Assume first arg is input file
                    if os.path.isfile(file_path):
                        file_size_bytes = os.path.getsize(file_path)
                        file_size_mb = file_size_bytes / (1024 * 1024)
                except:
                    pass

            with _global_monitor.measure_operation(
                operation_name, file_size_mb
            ) as metrics_container:
                result = func(*args, **kwargs)

                # Store function result in metrics metadata
                if metrics_container["metrics"]:
                    metrics_container["metrics"].metadata["function_result"] = str(
                        result
                    )

                return result

        return wrapper

    return decorator


@contextmanager
def time_operation(operation_name: str, file_size_mb: float | None = None):
    """Simple context manager for timing operations.

    Args:
        operation_name: Name of the operation
        file_size_mb: Optional file size for throughput calculation

    Example:
        with time_operation("file_conversion", 5.2):
            # conversion logic here
            pass
    """
    with _global_monitor.measure_operation(operation_name, file_size_mb):
        yield


def get_system_info() -> dict[str, Any]:
    """Get comprehensive system information.

    Returns:
        Dictionary with system information
    """
    try:
        import platform

        return {
            "platform": platform.platform(),
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "python_version": platform.python_version(),
            "cpu_count": psutil.cpu_count(),
            "cpu_count_logical": psutil.cpu_count(logical=True),
            "memory_total_gb": round(psutil.virtual_memory().total / (1024**3), 2),
            "boot_time": psutil.boot_time(),
        }
    except Exception as e:
        return {"error": f"Unable to retrieve system info: {e!s}"}


def benchmark_system() -> dict[str, Any]:
    """Run a simple system benchmark.

    Returns:
        Dictionary with benchmark results
    """
    results = {}

    # CPU benchmark (simple math operations)
    start_time = time.time()
    for i in range(1000000):
        _ = i * i + i / 2
    cpu_time = time.time() - start_time
    results["cpu_benchmark_seconds"] = round(cpu_time, 3)

    # Memory benchmark (allocate and deallocate memory)
    start_time = time.time()
    data = [0] * 1000000  # Allocate ~8MB of integers
    _ = sum(data)
    del data
    memory_time = time.time() - start_time
    results["memory_benchmark_seconds"] = round(memory_time, 3)

    # Disk I/O benchmark (if possible)
    try:
        import os
        import tempfile

        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_path = temp_file.name

            # Write benchmark
            start_time = time.time()
            data = b"x" * (1024 * 1024)  # 1MB of data
            for _ in range(10):
                temp_file.write(data)
            temp_file.flush()
            write_time = time.time() - start_time

        # Read benchmark
        start_time = time.time()
        with open(temp_path, "rb") as f:
            while f.read(1024 * 1024):
                pass
        read_time = time.time() - start_time

        # Cleanup
        os.unlink(temp_path)

        results["disk_write_benchmark_seconds"] = round(write_time, 3)
        results["disk_read_benchmark_seconds"] = round(read_time, 3)
        results["disk_write_speed_mbps"] = (
            round(10 / write_time, 2) if write_time > 0 else 0
        )
        results["disk_read_speed_mbps"] = (
            round(10 / read_time, 2) if read_time > 0 else 0
        )

    except Exception:
        results["disk_benchmark_error"] = "Unable to perform disk benchmark"

    return results
