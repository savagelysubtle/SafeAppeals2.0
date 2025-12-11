"""Adapters for interfacing with external systems.

This package contains adapter modules that connect the core business logic
with external interfaces such as CLI, Electron GUI bridges, and other
integration points.
"""

from .bridges.electron_bridge import main as electron_bridge_main

__all__ = [
    "electron_bridge_main",
]
