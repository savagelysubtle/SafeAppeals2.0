"""CLI command to check dependency status."""

import json
import sys

from transmutation_codex.core import get_dependency_checker


def check_dependency_status(output_format: str = "text") -> None:
    """Check and display dependency status.

    Args:
        output_format: Output format ('text', 'json')
    """
    dependency_checker = get_dependency_checker()
    status = dependency_checker.get_dependency_status()

    if output_format == "json":
        # Convert to JSON-serializable format
        json_status = {}
        for category, deps in status.items():
            json_status[category] = {}
            for dep_name, (is_available, message) in deps.items():
                json_status[category][dep_name] = {
                    "available": is_available,
                    "message": message,
                }

        print(json.dumps(json_status, indent=2))
        return

    # Text output
    print("🔍 Dependency Status Check")
    print("=" * 50)

    for category, deps in status.items():
        print(f"\n📦 {category.replace('_', ' ').title()}")
        print("-" * 30)

        available_count = 0
        total_count = len(deps)

        for dep_name, (is_available, message) in deps.items():
            status_icon = "✅" if is_available else "❌"
            print(f"{status_icon} {dep_name}: {message}")

            if is_available:
                available_count += 1

        print(f"\nSummary: {available_count}/{total_count} available")

    # Overall summary
    total_deps = sum(len(deps) for deps in status.values())
    total_available = sum(
        sum(1 for is_available, _ in deps.values() if is_available)
        for deps in status.values()
    )

    print(f"\n🎯 Overall Status: {total_available}/{total_deps} dependencies available")

    if total_available < total_deps:
        print(
            "\n⚠️  Some dependencies are missing. Install them to enable all features:"
        )
        print("   uv add <missing-package>")
        print("   Or run: scripts/setup_external_dependencies.ps1")
        sys.exit(1)
    else:
        print("\n🎉 All dependencies are available!")
        sys.exit(0)


def check_converter_dependencies(converter_type: str) -> None:
    """Check dependencies for a specific converter.

    Args:
        converter_type: Type of converter to check
    """
    dependency_checker = get_dependency_checker()
    dependencies = dependency_checker.check_converter_dependencies(converter_type)

    print(f"🔍 Dependencies for {converter_type}")
    print("=" * 40)

    if not dependencies:
        print("No specific dependencies required.")
        return

    missing_required = []
    missing_optional = []

    for dep_name, (is_available, message) in dependencies.items():
        status_icon = "✅" if is_available else "❌"
        print(f"{status_icon} {dep_name}: {message}")

        if not is_available:
            if dep_name in ["tesseract", "ghostscript"]:
                missing_required.append(dep_name)
            else:
                missing_optional.append(dep_name)

    if missing_required:
        print(f"\n❌ Missing required dependencies: {', '.join(missing_required)}")
        print("This converter will not work without these dependencies.")
        sys.exit(1)

    if missing_optional:
        print(f"\n⚠️  Missing optional dependencies: {', '.join(missing_optional)}")
        print("Some features may be limited.")

    if not missing_required and not missing_optional:
        print("\n🎉 All dependencies are available!")
        sys.exit(0)
