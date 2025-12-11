"""Event system for the Transmutation Codex.

This module provides an event-driven architecture for plugin communication,
enabling loose coupling between components and extensible functionality
through event handlers and publishers.
"""

import threading
import time
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class EventPriority(Enum):
    """Event handler priority levels."""

    LOWEST = 0
    LOW = 1
    NORMAL = 2
    HIGH = 3
    HIGHEST = 4


@dataclass
class Event:
    """Base event class for all events in the system."""

    event_type: str
    timestamp: float = field(default_factory=time.time)
    source: str | None = None
    data: dict[str, Any] = field(default_factory=dict)
    cancellable: bool = True
    cancelled: bool = False

    def cancel(self) -> None:
        """Cancel the event if it's cancellable."""
        if self.cancellable:
            self.cancelled = True

    def is_cancelled(self) -> bool:
        """Check if the event has been cancelled."""
        return self.cancelled

    def get_data(self, key: str, default: Any = None) -> Any:
        """Get data from the event."""
        return self.data.get(key, default)

    def set_data(self, key: str, value: Any) -> None:
        """Set data in the event."""
        self.data[key] = value


@dataclass
class ConversionEvent(Event):
    """Event related to document conversion operations."""

    input_file: str | None = None
    output_file: str | None = None
    conversion_type: str | None = None
    plugin_name: str | None = None

    def __post_init__(self):
        # Populate data dict with conversion-specific fields
        self.data.update(
            {
                "input_file": self.input_file,
                "output_file": self.output_file,
                "conversion_type": self.conversion_type,
                "plugin_name": self.plugin_name,
            }
        )


@dataclass
class ProgressEvent(Event):
    """Event related to progress updates."""

    operation_id: str | None = None
    current_step: int = 0
    total_steps: int = 0
    progress_percentage: float = 0.0

    def __post_init__(self):
        self.data.update(
            {
                "operation_id": self.operation_id,
                "current_step": self.current_step,
                "total_steps": self.total_steps,
                "progress_percentage": self.progress_percentage,
            }
        )


@dataclass
class ErrorEvent(Event):
    """Event related to errors and exceptions."""

    error_message: str | None = None
    exception_type: str | None = None
    traceback: str | None = None

    def __post_init__(self):
        self.data.update(
            {
                "error_message": self.error_message,
                "exception_type": self.exception_type,
                "traceback": self.traceback,
            }
        )


@dataclass
class EventHandler:
    """Event handler registration information."""

    callback: Callable[[Event], None]
    priority: EventPriority = EventPriority.NORMAL
    once: bool = False
    condition: Callable[[Event], bool] | None = None
    registration_time: float = field(default_factory=time.time)
    call_count: int = 0

    def should_handle(self, event: Event) -> bool:
        """Check if this handler should process the event."""
        if self.condition and not self.condition(event):
            return False
        return True

    def handle(self, event: Event) -> None:
        """Handle the event and update statistics."""
        self.callback(event)
        self.call_count += 1


class EventBus:
    """Event bus for managing event publishing and subscription.

    This class provides a centralized event system that allows components
    to communicate through events without direct coupling.
    """

    def __init__(self):
        """Initialize the event bus."""
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)
        self._global_handlers: list[EventHandler] = []
        self._lock = threading.RLock()
        self._event_history: list[Event] = []
        self._max_history_size = 1000
        self._statistics = {
            "events_published": 0,
            "events_handled": 0,
            "handlers_registered": 0,
            "start_time": time.time(),
        }

    def subscribe(
        self,
        event_type: str,
        callback: Callable[[Event], None],
        priority: EventPriority = EventPriority.NORMAL,
        once: bool = False,
        condition: Callable[[Event], bool] | None = None,
    ) -> str:
        """Subscribe to events of a specific type.

        Args:
            event_type: Type of events to subscribe to
            callback: Function to call when event occurs
            priority: Priority level for handler execution order
            once: Whether to unsubscribe after first event
            condition: Optional condition function to filter events

        Returns:
            Handler ID for unsubscribing
        """
        with self._lock:
            handler = EventHandler(
                callback=callback, priority=priority, once=once, condition=condition
            )

            self._handlers[event_type].append(handler)

            # Sort handlers by priority (highest first)
            self._handlers[event_type].sort(
                key=lambda h: h.priority.value, reverse=True
            )

            self._statistics["handlers_registered"] += 1

            # Return handler ID for unsubscribing
            return f"{event_type}_{id(handler)}"

    def subscribe_global(
        self,
        callback: Callable[[Event], None],
        priority: EventPriority = EventPriority.NORMAL,
        condition: Callable[[Event], bool] | None = None,
    ) -> str:
        """Subscribe to all events (global handler).

        Args:
            callback: Function to call for any event
            priority: Priority level for handler execution order
            condition: Optional condition function to filter events

        Returns:
            Handler ID for unsubscribing
        """
        with self._lock:
            handler = EventHandler(
                callback=callback, priority=priority, condition=condition
            )

            self._global_handlers.append(handler)
            self._global_handlers.sort(key=lambda h: h.priority.value, reverse=True)

            self._statistics["handlers_registered"] += 1

            return f"global_{id(handler)}"

    def unsubscribe(self, handler_id: str) -> bool:
        """Unsubscribe a handler.

        Args:
            handler_id: Handler ID returned from subscribe

        Returns:
            True if handler was found and removed
        """
        with self._lock:
            if handler_id.startswith("global_"):
                # Remove from global handlers
                handler_obj_id = int(handler_id.split("_", 1)[1])
                for i, handler in enumerate(self._global_handlers):
                    if id(handler) == handler_obj_id:
                        del self._global_handlers[i]
                        return True
            else:
                # Remove from specific event type handlers
                event_type, handler_obj_id_str = handler_id.rsplit("_", 1)
                handler_obj_id = int(handler_obj_id_str)

                if event_type in self._handlers:
                    for i, handler in enumerate(self._handlers[event_type]):
                        if id(handler) == handler_obj_id:
                            del self._handlers[event_type][i]
                            return True

        return False

    def publish(self, event: Event, async_execution: bool = False) -> None:
        """Publish an event to all subscribers.

        Args:
            event: Event to publish
            async_execution: Whether to execute handlers asynchronously
        """
        if async_execution:
            threading.Thread(
                target=self._publish_sync, args=(event,), daemon=True
            ).start()
        else:
            self._publish_sync(event)

    def _publish_sync(self, event: Event) -> None:
        """Synchronously publish an event."""
        with self._lock:
            self._statistics["events_published"] += 1

            # Add to event history
            self._event_history.append(event)
            if len(self._event_history) > self._max_history_size:
                self._event_history.pop(0)

            # Collect all handlers for this event
            handlers_to_execute = []

            # Add specific event type handlers
            if event.event_type in self._handlers:
                handlers_to_execute.extend(self._handlers[event.event_type])

            # Add global handlers
            handlers_to_execute.extend(self._global_handlers)

            # Sort by priority
            handlers_to_execute.sort(key=lambda h: h.priority.value, reverse=True)

        # Execute handlers outside of lock to prevent deadlocks
        handlers_to_remove = []

        for handler in handlers_to_execute:
            try:
                if event.is_cancelled() and event.cancellable:
                    break

                if handler.should_handle(event):
                    handler.handle(event)
                    self._statistics["events_handled"] += 1

                    if handler.once:
                        handlers_to_remove.append((event.event_type, handler))

            except Exception:
                # Don't let handler errors break event processing
                pass

        # Remove one-time handlers
        with self._lock:
            for event_type, handler in handlers_to_remove:
                if event_type == "global":
                    if handler in self._global_handlers:
                        self._global_handlers.remove(handler)
                else:
                    if (
                        event_type in self._handlers
                        and handler in self._handlers[event_type]
                    ):
                        self._handlers[event_type].remove(handler)

    def emit(
        self,
        event_type: str,
        source: str | None = None,
        cancellable: bool = True,
        **data,
    ) -> Event:
        """Create and publish an event.

        Args:
            event_type: Type of event to emit
            source: Source of the event
            cancellable: Whether the event can be cancelled
            **data: Event data

        Returns:
            The created event
        """
        event = Event(
            event_type=event_type, source=source, cancellable=cancellable, data=data
        )

        self.publish(event)
        return event

    def emit_conversion_event(
        self,
        event_type: str,
        input_file: str | None = None,
        output_file: str | None = None,
        conversion_type: str | None = None,
        plugin_name: str | None = None,
        source: str | None = None,
        **additional_data,
    ) -> ConversionEvent:
        """Create and publish a conversion event.

        Args:
            event_type: Type of conversion event
            input_file: Input file path
            output_file: Output file path
            conversion_type: Type of conversion
            plugin_name: Name of plugin handling conversion
            source: Source of the event
            **additional_data: Additional event data

        Returns:
            The created conversion event
        """
        event = ConversionEvent(
            event_type=event_type,
            source=source,
            input_file=input_file,
            output_file=output_file,
            conversion_type=conversion_type,
            plugin_name=plugin_name,
        )

        event.data.update(additional_data)
        self.publish(event)
        return event

    def emit_progress_event(
        self,
        event_type: str,
        operation_id: str | None = None,
        current_step: int = 0,
        total_steps: int = 0,
        progress_percentage: float = 0.0,
        source: str | None = None,
        **additional_data,
    ) -> ProgressEvent:
        """Create and publish a progress event.

        Args:
            event_type: Type of progress event
            operation_id: ID of the operation
            current_step: Current step number
            total_steps: Total number of steps
            progress_percentage: Progress percentage
            source: Source of the event
            **additional_data: Additional event data

        Returns:
            The created progress event
        """
        event = ProgressEvent(
            event_type=event_type,
            source=source,
            operation_id=operation_id,
            current_step=current_step,
            total_steps=total_steps,
            progress_percentage=progress_percentage,
        )

        event.data.update(additional_data)
        self.publish(event)
        return event

    def emit_error_event(
        self,
        event_type: str,
        error_message: str | None = None,
        exception_type: str | None = None,
        traceback: str | None = None,
        source: str | None = None,
        **additional_data,
    ) -> ErrorEvent:
        """Create and publish an error event.

        Args:
            event_type: Type of error event
            error_message: Error message
            exception_type: Type of exception
            traceback: Exception traceback
            source: Source of the event
            **additional_data: Additional event data

        Returns:
            The created error event
        """
        event = ErrorEvent(
            event_type=event_type,
            source=source,
            error_message=error_message,
            exception_type=exception_type,
            traceback=traceback,
        )

        event.data.update(additional_data)
        self.publish(event)
        return event

    def get_event_history(
        self, event_type: str | None = None, limit: int | None = None
    ) -> list[Event]:
        """Get event history.

        Args:
            event_type: Optional filter by event type
            limit: Optional limit on number of events returned

        Returns:
            List of events from history
        """
        with self._lock:
            events = self._event_history.copy()

        if event_type:
            events = [e for e in events if e.event_type == event_type]

        if limit:
            events = events[-limit:]

        return events

    def get_statistics(self) -> dict[str, Any]:
        """Get event bus statistics.

        Returns:
            Dictionary with statistics
        """
        with self._lock:
            uptime_hours = (time.time() - self._statistics["start_time"]) / 3600

            handler_count = sum(len(handlers) for handlers in self._handlers.values())
            handler_count += len(self._global_handlers)

            return {
                "events_published": self._statistics["events_published"],
                "events_handled": self._statistics["events_handled"],
                "handlers_registered": self._statistics["handlers_registered"],
                "active_handlers": handler_count,
                "event_types_subscribed": len(self._handlers),
                "global_handlers": len(self._global_handlers),
                "events_in_history": len(self._event_history),
                "uptime_hours": round(uptime_hours, 2),
                "events_per_hour": round(
                    self._statistics["events_published"] / uptime_hours, 2
                )
                if uptime_hours > 0
                else 0,
            }

    def clear_history(self) -> None:
        """Clear event history."""
        with self._lock:
            self._event_history.clear()

    def list_subscribers(
        self, event_type: str | None = None
    ) -> dict[str, list[dict[str, Any]]]:
        """List current subscribers.

        Args:
            event_type: Optional filter by event type

        Returns:
            Dictionary with subscriber information
        """
        with self._lock:
            result = {}

            if event_type:
                if event_type in self._handlers:
                    result[event_type] = [
                        {
                            "priority": handler.priority.name,
                            "once": handler.once,
                            "call_count": handler.call_count,
                            "registration_time": handler.registration_time,
                        }
                        for handler in self._handlers[event_type]
                    ]
            else:
                for et, handlers in self._handlers.items():
                    result[et] = [
                        {
                            "priority": handler.priority.name,
                            "once": handler.once,
                            "call_count": handler.call_count,
                            "registration_time": handler.registration_time,
                        }
                        for handler in handlers
                    ]

            # Add global handlers
            if not event_type or event_type == "global":
                result["global"] = [
                    {
                        "priority": handler.priority.name,
                        "call_count": handler.call_count,
                        "registration_time": handler.registration_time,
                    }
                    for handler in self._global_handlers
                ]

            return result


# Global event bus instance
_global_event_bus = EventBus()


def get_event_bus() -> EventBus:
    """Get the global event bus instance."""
    return _global_event_bus


# Convenience functions for working with the global event bus


def subscribe(event_type: str, callback: Callable[[Event], None], **kwargs) -> str:
    """Subscribe to events with the global event bus."""
    return _global_event_bus.subscribe(event_type, callback, **kwargs)


def unsubscribe(handler_id: str) -> bool:
    """Unsubscribe from events with the global event bus."""
    return _global_event_bus.unsubscribe(handler_id)


def publish(event: Event, async_execution: bool = False) -> None:
    """Publish an event with the global event bus."""
    _global_event_bus.publish(event, async_execution)


def emit(event_type: str, **kwargs) -> Event:
    """Emit an event with the global event bus."""
    return _global_event_bus.emit(event_type, **kwargs)


# Event type constants
class EventTypes:
    """Common event type constants."""

    # Conversion events
    CONVERSION_STARTED = "conversion.started"
    CONVERSION_COMPLETED = "conversion.completed"
    CONVERSION_FAILED = "conversion.failed"
    CONVERSION_PROGRESS = "conversion.progress"

    # Plugin events
    PLUGIN_LOADED = "plugin.loaded"
    PLUGIN_ERROR = "plugin.error"
    PLUGIN_UNLOADED = "plugin.unloaded"

    # Progress events
    PROGRESS_STARTED = "progress.started"
    PROGRESS_UPDATED = "progress.updated"
    PROGRESS_COMPLETED = "progress.completed"
    PROGRESS_CANCELLED = "progress.cancelled"

    # System events
    SYSTEM_ERROR = "system.error"
    SYSTEM_WARNING = "system.warning"
    SYSTEM_INFO = "system.info"

    # Configuration events
    CONFIG_CHANGED = "config.changed"
    CONFIG_LOADED = "config.loaded"
    CONFIG_SAVED = "config.saved"

    # Cache events
    CACHE_HIT = "cache.hit"
    CACHE_MISS = "cache.miss"
    CACHE_CLEARED = "cache.cleared"
