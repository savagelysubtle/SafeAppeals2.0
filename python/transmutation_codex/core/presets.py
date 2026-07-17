"""Conversion presets system.

This module provides a way for users to save and manage their favorite
conversion settings as reusable presets.
"""

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any

from .exceptions import ValidationError, raise_validation_error


@dataclass
class ConversionPreset:
    """A saved conversion configuration.

    Presets allow users to save their favorite conversion settings
    and reuse them across conversions.

    Attributes:
        name: Unique name for the preset
        conversion_type: Type of conversion (e.g., "pdf2md", "md2pdf")
        options: Dictionary of converter options
        description: Human-readable description
        tags: List of tags for organization
        created_at: When the preset was created
        updated_at: When the preset was last modified
    """

    name: str
    conversion_type: str
    options: dict[str, Any]
    description: str = ""
    tags: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def __post_init__(self):
        """Validate preset data."""
        if not self.name or not self.name.strip():
            raise ValidationError("Preset name cannot be empty")

        if not self.conversion_type or "2" not in self.conversion_type:
            raise ValidationError(
                f"Invalid conversion type: {self.conversion_type}. Expected format: source2target"
            )

        # Normalize name (lowercase, no special chars except underscore/dash)
        self.name = self.name.lower().replace(" ", "_")

    def to_dict(self) -> dict[str, Any]:
        """Convert preset to dictionary.

        Returns:
            Dictionary representation of preset
        """
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ConversionPreset":
        """Create preset from dictionary.

        Args:
            data: Dictionary with preset data

        Returns:
            ConversionPreset instance

        Raises:
            ValidationError: If data is invalid
        """
        try:
            return cls(**data)
        except TypeError as e:
            raise ValidationError(f"Invalid preset data: {e}") from e

    def update_timestamp(self) -> None:
        """Update the updated_at timestamp to now."""
        self.updated_at = datetime.now().isoformat()


class PresetManager:
    """Manages conversion presets.

    This class handles saving, loading, and managing conversion presets,
    including persistence to disk.
    """

    def __init__(self, presets_file: Path | None = None):
        """Initialize preset manager.

        Args:
            presets_file: Path to presets JSON file (auto-determined if None)
        """
        if presets_file is None:
            # Default to user's home directory
            presets_dir = Path.home() / ".aichemist_codex"
            presets_dir.mkdir(exist_ok=True)
            presets_file = presets_dir / "presets.json"

        self.presets_file = Path(presets_file)
        self._presets: dict[str, ConversionPreset] = {}
        self._load_presets()

    def _load_presets(self) -> None:
        """Load presets from disk."""
        if not self.presets_file.exists():
            # Create default presets
            self._create_default_presets()
            return

        try:
            with open(self.presets_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            self._presets = {
                name: ConversionPreset.from_dict(preset_data)
                for name, preset_data in data.items()
            }
        except (json.JSONDecodeError, ValidationError) as e:
            # If presets file is corrupted, start fresh
            self._presets = {}
            self._create_default_presets()

    def _save_presets(self) -> None:
        """Save presets to disk."""
        data = {
            name: preset.to_dict()
            for name, preset in self._presets.items()
        }

        # Ensure parent directory exists
        self.presets_file.parent.mkdir(parents=True, exist_ok=True)

        with open(self.presets_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _create_default_presets(self) -> None:
        """Create default presets."""
        default_presets = [
            ConversionPreset(
                name="high_quality_ocr",
                conversion_type="pdf2md",
                options={"engine": "enhanced_ocr", "dpi": 600, "lang": "eng"},
                description="High-quality OCR with enhanced preprocessing",
                tags=["ocr", "quality", "pdf"]
            ),
            ConversionPreset(
                name="fast_pdf_conversion",
                conversion_type="pdf2md",
                options={"engine": "basic", "auto_ocr": False},
                description="Fast PDF to Markdown without OCR",
                tags=["fast", "pdf"]
            ),
            ConversionPreset(
                name="llm_optimized",
                conversion_type="pdf2md",
                options={"engine": "pymupdf4llm"},
                description="PDF to Markdown optimized for LLM consumption",
                tags=["llm", "pdf", "ai"]
            ),
            ConversionPreset(
                name="standard_markdown_pdf",
                conversion_type="md2pdf",
                options={"page_break_marker": "<!-- pagebreak -->"},
                description="Standard Markdown to PDF conversion",
                tags=["markdown", "pdf"]
            ),
            ConversionPreset(
                name="multilingual_ocr",
                conversion_type="pdf2md",
                options={"engine": "enhanced_ocr", "lang": "eng+fra+deu", "dpi": 300},
                description="OCR for English, French, and German documents",
                tags=["ocr", "multilingual", "pdf"]
            ),
        ]

        for preset in default_presets:
            self._presets[preset.name] = preset

        self._save_presets()

    def save_preset(self, preset: ConversionPreset, overwrite: bool = False) -> None:
        """Save a preset.

        Args:
            preset: Preset to save
            overwrite: Whether to overwrite if preset exists

        Raises:
            ValidationError: If preset name exists and overwrite=False
        """
        if preset.name in self._presets and not overwrite:
            raise_validation_error(
                f"Preset '{preset.name}' already exists. Use overwrite=True to replace it."
            )

        preset.update_timestamp()
        self._presets[preset.name] = preset
        self._save_presets()

    def get_preset(self, name: str) -> ConversionPreset | None:
        """Get a preset by name.

        Args:
            name: Preset name

        Returns:
            ConversionPreset if found, None otherwise
        """
        return self._presets.get(name.lower().replace(" ", "_"))

    def delete_preset(self, name: str) -> bool:
        """Delete a preset.

        Args:
            name: Preset name

        Returns:
            True if preset was deleted, False if not found
        """
        normalized_name = name.lower().replace(" ", "_")
        if normalized_name in self._presets:
            del self._presets[normalized_name]
            self._save_presets()
            return True
        return False

    def list_presets(
        self,
        conversion_type: str | None = None,
        tags: list[str] | None = None
    ) -> list[ConversionPreset]:
        """List presets, optionally filtered.

        Args:
            conversion_type: Filter by conversion type (e.g., "pdf2md")
            tags: Filter by tags (presets must have ALL tags)

        Returns:
            List of matching presets
        """
        presets = list(self._presets.values())

        # Filter by conversion type
        if conversion_type:
            presets = [p for p in presets if p.conversion_type == conversion_type]

        # Filter by tags
        if tags:
            presets = [
                p for p in presets
                if all(tag in p.tags for tag in tags)
            ]

        # Sort by name
        presets.sort(key=lambda p: p.name)

        return presets

    def get_all_tags(self) -> list[str]:
        """Get all unique tags across all presets.

        Returns:
            Sorted list of unique tags
        """
        all_tags = set()
        for preset in self._presets.values():
            all_tags.update(preset.tags)
        return sorted(all_tags)

    def export_preset(self, name: str, output_path: Path) -> None:
        """Export a preset to a JSON file.

        Args:
            name: Preset name
            output_path: Path to save preset

        Raises:
            ValidationError: If preset not found
        """
        preset = self.get_preset(name)
        if not preset:
            raise_validation_error(f"Preset '{name}' not found")

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(preset.to_dict(), f, indent=2, ensure_ascii=False)

    def import_preset(self, input_path: Path, overwrite: bool = False) -> ConversionPreset:
        """Import a preset from a JSON file.

        Args:
            input_path: Path to preset file
            overwrite: Whether to overwrite if preset exists

        Returns:
            Imported preset

        Raises:
            ValidationError: If file is invalid or preset exists
        """
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        preset = ConversionPreset.from_dict(data)
        self.save_preset(preset, overwrite=overwrite)
        return preset

    def update_preset(self, name: str, **updates) -> ConversionPreset:
        """Update a preset's fields.

        Args:
            name: Preset name
            **updates: Fields to update

        Returns:
            Updated preset

        Raises:
            ValidationError: If preset not found
        """
        preset = self.get_preset(name)
        if not preset:
            raise_validation_error(f"Preset '{name}' not found")

        # Update fields
        for key, value in updates.items():
            if hasattr(preset, key):
                setattr(preset, key, value)

        preset.update_timestamp()
        self._save_presets()
        return preset


# Global preset manager instance
_preset_manager: PresetManager | None = None


def get_preset_manager() -> PresetManager:
    """Get the global preset manager instance.

    Returns:
        PresetManager singleton
    """
    global _preset_manager
    if _preset_manager is None:
        _preset_manager = PresetManager()
    return _preset_manager
