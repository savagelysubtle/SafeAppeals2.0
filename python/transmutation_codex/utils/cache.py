"""Caching utilities for the Transmutation Codex.

This module provides caching functionality for conversion results,
enabling faster repeated conversions and improved performance
for frequently accessed files.
"""

import hashlib
import json
import os
import pickle
import threading
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass
class CacheEntry:
    """Represents a cache entry with metadata."""

    key: str
    value: Any
    created_at: float
    accessed_at: float
    access_count: int
    file_hash: str | None = None
    file_size: int | None = None
    metadata: dict[str, Any] | None = None

    def is_expired(self, ttl_seconds: float | None = None) -> bool:
        """Check if the cache entry has expired."""
        if ttl_seconds is None:
            return False
        return time.time() - self.created_at > ttl_seconds

    def touch(self):
        """Update access time and increment access count."""
        self.accessed_at = time.time()
        self.access_count += 1

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)


class ConversionCache:
    """In-memory cache for conversion results with optional persistence.

    This class provides caching functionality for document conversion
    results, with support for TTL, LRU eviction, and file change detection.
    """

    def __init__(
        self,
        max_size: int = 1000,
        default_ttl_hours: float = 24.0,
        cache_dir: str | None = None,
        enable_persistence: bool = False,
    ):
        """Initialize the conversion cache.

        Args:
            max_size: Maximum number of cache entries
            default_ttl_hours: Default TTL in hours (None for no expiry)
            cache_dir: Directory for persistent cache storage
            enable_persistence: Whether to enable persistent caching
        """
        self.max_size = max_size
        self.default_ttl_seconds = (
            default_ttl_hours * 3600 if default_ttl_hours else None
        )
        self.cache_dir = cache_dir
        self.enable_persistence = enable_persistence

        self._cache: dict[str, CacheEntry] = {}
        self._lock = threading.RLock()

        # Create cache directory if persistence is enabled
        if self.enable_persistence and self.cache_dir:
            Path(self.cache_dir).mkdir(parents=True, exist_ok=True)
            self._load_persistent_cache()

    def _generate_cache_key(
        self,
        input_file: str,
        conversion_type: str,
        options: dict[str, Any] | None = None,
    ) -> str:
        """Generate a cache key for a conversion.

        Args:
            input_file: Path to input file
            conversion_type: Type of conversion (e.g., 'md2pdf')
            options: Additional conversion options

        Returns:
            Cache key string
        """
        # Include file path, conversion type, and options in the key
        key_data = {
            "input_file": str(input_file),
            "conversion_type": conversion_type,
            "options": options or {},
        }

        # Create hash of the key data
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.sha256(key_str.encode()).hexdigest()[:16]

    def _calculate_file_hash(self, file_path: str) -> str | None:
        """Calculate hash of file contents for change detection."""
        logger.debug(f"Calculating file hash: {file_path}")
        try:
            hasher = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    hasher.update(chunk)
            hash_result = hasher.hexdigest()
            logger.debug(f"File hash calculated: {hash_result[:16]}...")
            return hash_result
        except Exception as e:
            error_code = ErrorCode.UTILS_CACHE_OPERATION_FAILED
            logger.error(f"[{error_code}] Failed to calculate file hash for {file_path}: {e}", exc_info=True)
            return None

    def _is_file_changed(self, file_path: str, cached_hash: str | None) -> bool:
        """Check if file has changed since caching."""
        if not cached_hash:
            return True

        current_hash = self._calculate_file_hash(file_path)
        return current_hash != cached_hash

    def _evict_lru(self):
        """Evict least recently used entries to make space."""
        if len(self._cache) < self.max_size:
            return

        # Sort by access time (oldest first)
        sorted_entries = sorted(self._cache.items(), key=lambda x: x[1].accessed_at)

        # Remove oldest entries until we're under the limit
        entries_to_remove = len(self._cache) - self.max_size + 1
        for i in range(entries_to_remove):
            key_to_remove = sorted_entries[i][0]
            del self._cache[key_to_remove]

    def _cleanup_expired(self):
        """Remove expired cache entries."""
        if not self.default_ttl_seconds:
            return

        expired_keys = []
        for key, entry in self._cache.items():
            if entry.is_expired(self.default_ttl_seconds):
                expired_keys.append(key)

        for key in expired_keys:
            del self._cache[key]

    def _save_persistent_cache(self):
        """Save cache to persistent storage."""
        if not self.enable_persistence or not self.cache_dir:
            return

        logger.debug(f"Saving persistent cache to: {self.cache_dir}")
        try:
            cache_file = Path(self.cache_dir) / "conversion_cache.pkl"
            with open(cache_file, "wb") as f:
                pickle.dump(self._cache, f)
            logger.debug(f"Successfully saved persistent cache: {len(self._cache)} entries")
        except Exception as e:
            error_code = ErrorCode.UTILS_CACHE_SERIALIZATION_FAILED
            logger.error(f"[{error_code}] Failed to save persistent cache: {e}", exc_info=True)

    def _load_persistent_cache(self):
        """Load cache from persistent storage."""
        if not self.enable_persistence or not self.cache_dir:
            return

        logger.debug(f"Loading persistent cache from: {self.cache_dir}")
        try:
            cache_file = Path(self.cache_dir) / "conversion_cache.pkl"
            if cache_file.exists():
                with open(cache_file, "rb") as f:
                    self._cache = pickle.load(f)
                logger.debug(f"Successfully loaded persistent cache: {len(self._cache)} entries")

                # Clean up expired entries after loading
                self._cleanup_expired()
            else:
                logger.debug("Persistent cache file does not exist, starting with empty cache")
        except Exception as e:
            error_code = ErrorCode.UTILS_CACHE_SERIALIZATION_FAILED
            logger.error(f"[{error_code}] Failed to load persistent cache: {e}", exc_info=True)
            self._cache = {}  # Start with empty cache on load failure

    def get(
        self,
        input_file: str,
        conversion_type: str,
        options: dict[str, Any] | None = None,
    ) -> Any | None:
        """Get cached conversion result.

        Args:
            input_file: Path to input file
            conversion_type: Type of conversion
            options: Conversion options

        Returns:
            Cached result if found and valid, None otherwise
        """
        with self._lock:
            cache_key = self._generate_cache_key(input_file, conversion_type, options)

            if cache_key not in self._cache:
                return None

            entry = self._cache[cache_key]

            # Check if entry has expired
            if entry.is_expired(self.default_ttl_seconds):
                del self._cache[cache_key]
                return None

            # Check if source file has changed
            if os.path.exists(input_file) and self._is_file_changed(
                input_file, entry.file_hash
            ):
                del self._cache[cache_key]
                return None

            # Update access information
            entry.touch()

            return entry.value

    def put(
        self,
        input_file: str,
        conversion_type: str,
        result: Any,
        options: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Store conversion result in cache.

        Args:
            input_file: Path to input file
            conversion_type: Type of conversion
            result: Conversion result to cache
            options: Conversion options
            metadata: Additional metadata to store
        """
        with self._lock:
            cache_key = self._generate_cache_key(input_file, conversion_type, options)

            # Calculate file hash for change detection
            file_hash = self._calculate_file_hash(input_file)
            file_size = None

            try:
                if os.path.exists(input_file):
                    file_size = os.path.getsize(input_file)
            except Exception:
                pass

            # Create cache entry
            entry = CacheEntry(
                key=cache_key,
                value=result,
                created_at=time.time(),
                accessed_at=time.time(),
                access_count=1,
                file_hash=file_hash,
                file_size=file_size,
                metadata=metadata,
            )

            # Clean up before adding new entry
            self._cleanup_expired()
            self._evict_lru()

            # Store the entry
            self._cache[cache_key] = entry

            # Save to persistent storage if enabled
            if self.enable_persistence:
                self._save_persistent_cache()

    def invalidate(self, input_file: str, conversion_type: str | None = None) -> int:
        """Invalidate cache entries for a file.

        Args:
            input_file: Path to input file
            conversion_type: Optional specific conversion type to invalidate

        Returns:
            Number of entries invalidated
        """
        with self._lock:
            keys_to_remove = []

            for key, entry in self._cache.items():
                # Check if this entry is for the specified file
                if conversion_type:
                    # Invalidate specific conversion type
                    test_key = self._generate_cache_key(input_file, conversion_type)
                    if key.startswith(test_key[:8]):  # Partial match on hash prefix
                        keys_to_remove.append(key)
                else:
                    # Invalidate all conversions for this file
                    if str(input_file) in str(entry.metadata or {}):
                        keys_to_remove.append(key)

            for key in keys_to_remove:
                del self._cache[key]

            return len(keys_to_remove)

    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()

            # Clear persistent storage if enabled
            if self.enable_persistence and self.cache_dir:
                try:
                    cache_file = Path(self.cache_dir) / "conversion_cache.pkl"
                    if cache_file.exists():
                        cache_file.unlink()
                except Exception:
                    pass

    def get_stats(self) -> dict[str, Any]:
        """Get cache statistics.

        Returns:
            Dictionary with cache statistics
        """
        with self._lock:
            if not self._cache:
                return {
                    "size": 0,
                    "max_size": self.max_size,
                    "hit_rate": 0.0,
                    "total_access_count": 0,
                    "average_access_count": 0.0,
                    "oldest_entry_age_hours": 0.0,
                    "newest_entry_age_hours": 0.0,
                }

            total_access_count = sum(
                entry.access_count for entry in self._cache.values()
            )
            access_counts = [entry.access_count for entry in self._cache.values()]
            creation_times = [entry.created_at for entry in self._cache.values()]

            current_time = time.time()
            oldest_age = (current_time - min(creation_times)) / 3600  # Hours
            newest_age = (current_time - max(creation_times)) / 3600  # Hours

            return {
                "size": len(self._cache),
                "max_size": self.max_size,
                "total_access_count": total_access_count,
                "average_access_count": total_access_count / len(self._cache),
                "min_access_count": min(access_counts),
                "max_access_count": max(access_counts),
                "oldest_entry_age_hours": round(oldest_age, 2),
                "newest_entry_age_hours": round(newest_age, 2),
                "cache_dir": self.cache_dir,
                "persistence_enabled": self.enable_persistence,
            }

    def get_entries_info(self, limit: int = 20) -> list[dict[str, Any]]:
        """Get information about cache entries.

        Args:
            limit: Maximum number of entries to return

        Returns:
            List of cache entry information
        """
        with self._lock:
            # Sort by access count (most accessed first)
            sorted_entries = sorted(
                self._cache.values(), key=lambda x: x.access_count, reverse=True
            )

            entries_info = []
            for entry in sorted_entries[:limit]:
                info = {
                    "key": entry.key,
                    "created_at": datetime.fromtimestamp(entry.created_at).isoformat(),
                    "accessed_at": datetime.fromtimestamp(
                        entry.accessed_at
                    ).isoformat(),
                    "access_count": entry.access_count,
                    "file_size": entry.file_size,
                    "age_hours": round((time.time() - entry.created_at) / 3600, 2),
                    "metadata": entry.metadata,
                }
                entries_info.append(info)

            return entries_info

    def cleanup(self, max_age_hours: float | None = None) -> int:
        """Clean up cache entries.

        Args:
            max_age_hours: Remove entries older than this (None uses default TTL)

        Returns:
            Number of entries removed
        """
        with self._lock:
            initial_size = len(self._cache)

            if max_age_hours is not None:
                ttl_seconds = max_age_hours * 3600
                expired_keys = []

                for key, entry in self._cache.items():
                    if entry.is_expired(ttl_seconds):
                        expired_keys.append(key)

                for key in expired_keys:
                    del self._cache[key]
            else:
                self._cleanup_expired()

            return initial_size - len(self._cache)


# Global cache instance
_global_cache = ConversionCache()


def get_cache() -> ConversionCache:
    """Get the global cache instance."""
    return _global_cache


def configure_cache(
    max_size: int = 1000,
    default_ttl_hours: float = 24.0,
    cache_dir: str | None = None,
    enable_persistence: bool = False,
) -> None:
    """Configure the global cache instance.

    Args:
        max_size: Maximum number of cache entries
        default_ttl_hours: Default TTL in hours
        cache_dir: Directory for persistent cache storage
        enable_persistence: Whether to enable persistent caching
    """
    global _global_cache
    _global_cache = ConversionCache(
        max_size, default_ttl_hours, cache_dir, enable_persistence
    )


# Convenience functions for working with the global cache


def get_cached_result(
    input_file: str, conversion_type: str, options: dict[str, Any] | None = None
) -> Any | None:
    """Get cached conversion result from global cache."""
    return _global_cache.get(input_file, conversion_type, options)


def cache_result(
    input_file: str,
    conversion_type: str,
    result: Any,
    options: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Store conversion result in global cache."""
    _global_cache.put(input_file, conversion_type, result, options, metadata)


def invalidate_cache(input_file: str, conversion_type: str | None = None) -> int:
    """Invalidate cache entries in global cache."""
    return _global_cache.invalidate(input_file, conversion_type)


def clear_cache() -> None:
    """Clear all entries from global cache."""
    _global_cache.clear()


def get_cache_stats() -> dict[str, Any]:
    """Get statistics from global cache."""
    return _global_cache.get_stats()


def cache_conversion(conversion_type: str, use_options: bool = True):
    """Decorator for caching conversion function results.

    Args:
        conversion_type: Type of conversion for cache key generation
        use_options: Whether to include function kwargs in cache key

    Example:
        @cache_conversion("md2pdf")
        def convert_markdown_to_pdf(input_path, output_path, **options):
            # conversion logic
            return True
    """

    def decorator(func):
        def wrapper(*args, **kwargs):
            if len(args) < 2:
                # Not enough arguments for caching, execute normally
                return func(*args, **kwargs)

            input_file = str(args[0])
            output_file = str(args[1])

            # Generate options dict for cache key
            cache_options = kwargs if use_options else None

            # Check cache first
            cached_result = get_cached_result(
                input_file, conversion_type, cache_options
            )
            if cached_result is not None:
                # If output file path is in cached result, copy cached file to new location
                if isinstance(cached_result, dict) and "output_file" in cached_result:
                    try:
                        import shutil

                        cached_output = cached_result["output_file"]
                        if (
                            os.path.exists(cached_output)
                            and cached_output != output_file
                        ):
                            shutil.copy2(cached_output, output_file)
                    except Exception:
                        pass  # Fall back to normal execution if copy fails

                return cached_result

            # Execute function and cache result
            result = func(*args, **kwargs)

            # Store result in cache with metadata
            metadata = {
                "input_file": input_file,
                "output_file": output_file,
                "function_name": func.__name__,
            }

            cache_result(input_file, conversion_type, result, cache_options, metadata)

            return result

        return wrapper

    return decorator
