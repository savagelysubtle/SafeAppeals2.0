"""Progress tracking system for the Transmutation Codex.

This module provides progress tracking capabilities for conversion operations,
enabling real-time feedback to users through GUI, CLI, or other interfaces.
Supports both single-file and batch conversion progress tracking.
"""

import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any
from uuid import uuid4

from .exceptions import ProgressError


class OperationStatus(Enum):
    """Status of a tracked operation."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ProgressStep:
    """Information about a progress step."""

    step_number: int
    total_steps: int
    description: str
    status: OperationStatus = OperationStatus.PENDING
    start_time: float | None = None
    end_time: float | None = None
    error_message: str | None = None

    @property
    def duration(self) -> float | None:
        """Get the duration of this step in seconds."""
        if self.start_time is None:
            return None
        end = self.end_time or time.time()
        return end - self.start_time

    @property
    def progress_percentage(self) -> float:
        """Get progress percentage for this step."""
        if self.total_steps == 0:
            return 0.0
        return (self.step_number / self.total_steps) * 100.0


@dataclass
class OperationProgress:
    """Progress information for an operation."""

    operation_id: str
    operation_name: str
    status: OperationStatus = OperationStatus.PENDING
    current_step: int = 0
    total_steps: int = 0
    start_time: float | None = None
    end_time: float | None = None
    error_message: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    steps: list[ProgressStep] = field(default_factory=list)

    @property
    def progress_percentage(self) -> float:
        """Get overall progress percentage."""
        if self.total_steps == 0:
            return 0.0
        return (self.current_step / self.total_steps) * 100.0

    @property
    def duration(self) -> float | None:
        """Get total operation duration in seconds."""
        if self.start_time is None:
            return None
        end = self.end_time or time.time()
        return end - self.start_time

    @property
    def estimated_time_remaining(self) -> float | None:
        """Estimate remaining time in seconds."""
        if self.current_step == 0 or self.total_steps == 0 or self.start_time is None:
            return None

        elapsed = time.time() - self.start_time
        progress_ratio = self.current_step / self.total_steps

        if progress_ratio == 0:
            return None

        total_estimated = elapsed / progress_ratio
        return max(0, total_estimated - elapsed)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "operation_id": self.operation_id,
            "operation_name": self.operation_name,
            "status": self.status.value,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "progress_percentage": self.progress_percentage,
            "duration": self.duration,
            "estimated_time_remaining": self.estimated_time_remaining,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "error_message": self.error_message,
            "metadata": self.metadata,
            "steps": [
                {
                    "step_number": step.step_number,
                    "total_steps": step.total_steps,
                    "description": step.description,
                    "status": step.status.value,
                    "duration": step.duration,
                    "progress_percentage": step.progress_percentage,
                    "error_message": step.error_message,
                }
                for step in self.steps
            ],
        }


class ProgressTracker:
    """Thread-safe progress tracker for conversion operations.

    This class manages progress tracking for multiple concurrent operations,
    providing callbacks for real-time updates and status monitoring.
    """

    def __init__(self):
        """Initialize the progress tracker."""
        self._operations: dict[str, OperationProgress] = {}
        self._callbacks: list[Callable[[OperationProgress], None]] = []
        self._lock = threading.RLock()

    def add_callback(self, callback: Callable[[OperationProgress], None]) -> None:
        """Add a progress update callback.

        Args:
            callback: Function to call when progress updates occur
        """
        with self._lock:
            if callback not in self._callbacks:
                self._callbacks.append(callback)

    def remove_callback(self, callback: Callable[[OperationProgress], None]) -> None:
        """Remove a progress update callback.

        Args:
            callback: Function to remove from callbacks
        """
        with self._lock:
            if callback in self._callbacks:
                self._callbacks.remove(callback)

    def _notify_callbacks(self, operation: OperationProgress) -> None:
        """Notify all callbacks of progress update."""
        for callback in self._callbacks:
            try:
                callback(operation)
            except Exception:
                # Don't let callback errors break progress tracking
                pass

    def start_operation(
        self,
        operation_name: str,
        total_steps: int = 1,
        operation_id: str | None = None,
        **metadata,
    ) -> str:
        """Start tracking a new operation.

        Args:
            operation_name: Human-readable operation name
            total_steps: Total number of steps in the operation
            operation_id: Optional custom operation ID
            **metadata: Additional metadata to store with operation

        Returns:
            Operation ID for tracking
        """
        if operation_id is None:
            operation_id = str(uuid4())

        if total_steps <= 0:
            raise ProgressError(
                "Total steps must be positive", operation_id=operation_id
            )

        with self._lock:
            if operation_id in self._operations:
                raise ProgressError(
                    f"Operation with ID {operation_id} already exists",
                    operation_id=operation_id,
                )

            operation = OperationProgress(
                operation_id=operation_id,
                operation_name=operation_name,
                status=OperationStatus.RUNNING,
                total_steps=total_steps,
                start_time=time.time(),
                metadata=metadata,
            )

            self._operations[operation_id] = operation
            self._notify_callbacks(operation)

        return operation_id

    def update_progress(
        self,
        operation_id: str,
        current_step: int,
        step_description: str = "",
        **step_metadata,
    ) -> None:
        """Update progress for an operation.

        Args:
            operation_id: Operation ID
            current_step: Current step number (1-based)
            step_description: Description of current step
            **step_metadata: Additional metadata for this step
        """
        with self._lock:
            if operation_id not in self._operations:
                raise ProgressError(
                    f"Operation {operation_id} not found", operation_id=operation_id
                )

            operation = self._operations[operation_id]

            if operation.status not in [
                OperationStatus.RUNNING,
                OperationStatus.PENDING,
            ]:
                raise ProgressError(
                    f"Cannot update progress for operation in status {operation.status.value}",
                    operation_id=operation_id,
                )

            if current_step < 0 or current_step > operation.total_steps:
                raise ProgressError(
                    f"Invalid step number {current_step} (total: {operation.total_steps})",
                    operation_id=operation_id,
                    current_step=current_step,
                    total_steps=operation.total_steps,
                )

            # Update operation
            operation.current_step = current_step
            operation.status = OperationStatus.RUNNING

            # Add step information
            step = ProgressStep(
                step_number=current_step,
                total_steps=operation.total_steps,
                description=step_description,
                status=OperationStatus.RUNNING,
                start_time=time.time(),
            )

            # Complete previous step if exists
            if operation.steps:
                prev_step = operation.steps[-1]
                if prev_step.status == OperationStatus.RUNNING:
                    prev_step.status = OperationStatus.COMPLETED
                    prev_step.end_time = time.time()

            operation.steps.append(step)

            # Update metadata
            operation.metadata.update(step_metadata)

            self._notify_callbacks(operation)

    def complete_operation(
        self, operation_id: str, success: bool = True, error_message: str | None = None
    ) -> None:
        """Mark an operation as completed.

        Args:
            operation_id: Operation ID
            success: Whether operation completed successfully
            error_message: Error message if operation failed
        """
        with self._lock:
            if operation_id not in self._operations:
                raise ProgressError(
                    f"Operation {operation_id} not found", operation_id=operation_id
                )

            operation = self._operations[operation_id]

            # Complete current step if running
            if operation.steps:
                current_step = operation.steps[-1]
                if current_step.status == OperationStatus.RUNNING:
                    current_step.status = (
                        OperationStatus.COMPLETED if success else OperationStatus.FAILED
                    )
                    current_step.end_time = time.time()
                    if not success and error_message:
                        current_step.error_message = error_message

            # Complete operation
            operation.status = (
                OperationStatus.COMPLETED if success else OperationStatus.FAILED
            )
            operation.end_time = time.time()

            if not success:
                operation.error_message = error_message
                operation.current_step = operation.total_steps  # Set to completed steps
            elif operation.current_step < operation.total_steps:
                operation.current_step = operation.total_steps  # Ensure 100% progress

            self._notify_callbacks(operation)

    def cancel_operation(
        self, operation_id: str, reason: str = "Cancelled by user"
    ) -> None:
        """Cancel an operation.

        Args:
            operation_id: Operation ID
            reason: Reason for cancellation
        """
        with self._lock:
            if operation_id not in self._operations:
                raise ProgressError(
                    f"Operation {operation_id} not found", operation_id=operation_id
                )

            operation = self._operations[operation_id]

            # Cancel current step if running
            if operation.steps:
                current_step = operation.steps[-1]
                if current_step.status == OperationStatus.RUNNING:
                    current_step.status = OperationStatus.CANCELLED
                    current_step.end_time = time.time()
                    current_step.error_message = reason

            # Cancel operation
            operation.status = OperationStatus.CANCELLED
            operation.end_time = time.time()
            operation.error_message = reason

            self._notify_callbacks(operation)

    def get_operation(self, operation_id: str) -> OperationProgress | None:
        """Get operation progress.

        Args:
            operation_id: Operation ID

        Returns:
            OperationProgress if found, None otherwise
        """
        with self._lock:
            return self._operations.get(operation_id)

    def list_operations(
        self, status_filter: OperationStatus | None = None
    ) -> list[OperationProgress]:
        """List all operations, optionally filtered by status.

        Args:
            status_filter: Optional status to filter by

        Returns:
            List of operations
        """
        with self._lock:
            operations = list(self._operations.values())

            if status_filter:
                operations = [op for op in operations if op.status == status_filter]

            # Sort by start time (newest first)
            return sorted(operations, key=lambda op: op.start_time or 0, reverse=True)

    def clear_completed_operations(self, older_than_hours: float = 24.0) -> int:
        """Clear completed operations older than specified time.

        Args:
            older_than_hours: Remove operations older than this many hours

        Returns:
            Number of operations removed
        """
        cutoff_time = time.time() - (older_than_hours * 3600)
        removed_count = 0

        with self._lock:
            to_remove = []

            for operation_id, operation in self._operations.items():
                if (
                    operation.status
                    in [
                        OperationStatus.COMPLETED,
                        OperationStatus.FAILED,
                        OperationStatus.CANCELLED,
                    ]
                    and operation.end_time
                    and operation.end_time < cutoff_time
                ):
                    to_remove.append(operation_id)

            for operation_id in to_remove:
                del self._operations[operation_id]
                removed_count += 1

        return removed_count

    def get_summary(self) -> dict[str, Any]:
        """Get summary statistics of all operations.

        Returns:
            Dictionary with operation statistics
        """
        with self._lock:
            operations = list(self._operations.values())

            total = len(operations)
            running = len(
                [op for op in operations if op.status == OperationStatus.RUNNING]
            )
            completed = len(
                [op for op in operations if op.status == OperationStatus.COMPLETED]
            )
            failed = len(
                [op for op in operations if op.status == OperationStatus.FAILED]
            )
            cancelled = len(
                [op for op in operations if op.status == OperationStatus.CANCELLED]
            )

            # Calculate average duration for completed operations
            completed_ops = [
                op
                for op in operations
                if op.status == OperationStatus.COMPLETED and op.duration
            ]
            avg_duration = (
                sum(op.duration for op in completed_ops) / len(completed_ops)
                if completed_ops
                else 0
            )

            return {
                "total_operations": total,
                "running": running,
                "completed": completed,
                "failed": failed,
                "cancelled": cancelled,
                "average_duration": avg_duration,
                "operations": [op.to_dict() for op in operations],
            }


# Global progress tracker instance
_global_tracker = ProgressTracker()


def get_progress_tracker() -> ProgressTracker:
    """Get the global progress tracker instance."""
    return _global_tracker


# Convenience functions for working with the global tracker


def start_operation(operation_name: str, total_steps: int = 1, **metadata) -> str:
    """Start tracking an operation with the global tracker."""
    return _global_tracker.start_operation(operation_name, total_steps, **metadata)


def update_progress(
    operation_id: str, current_step: int, step_description: str = "", **metadata
) -> None:
    """Update progress with the global tracker."""
    _global_tracker.update_progress(
        operation_id, current_step, step_description, **metadata
    )


def complete_operation(
    operation_id: str, success: bool = True, error_message: str | None = None
) -> None:
    """Complete an operation with the global tracker."""
    _global_tracker.complete_operation(operation_id, success, error_message)


def cancel_operation(operation_id: str, reason: str = "Cancelled by user") -> None:
    """Cancel an operation with the global tracker."""
    _global_tracker.cancel_operation(operation_id, reason)


def get_operation(operation_id: str) -> OperationProgress | None:
    """Get operation from the global tracker."""
    return _global_tracker.get_operation(operation_id)
