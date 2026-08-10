#!/usr/bin/env python3
"""Generate SafeAppeals *app* icons from logo_cube_noshadow.png and apply them.

Converts the source PNG into the formats VS Code packaging / workbench need,
then writes them to the correct paths. Does **not** overwrite language-specific
file-association icons (typescript.ico, python.icns, etc.).

Usage (from repo root or anywhere):
    python safeappeals-icons/generate_app_icons.py

Requires: Pillow, icnsutil
    uv pip install pillow icnsutil
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path

from PIL import Image

try:
	import icnsutil
except ImportError as exc:  # pragma: no cover
	raise SystemExit("icnsutil required: uv pip install icnsutil") from exc

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(__file__).resolve().parent / "logo_cube_noshadow.png"

# Multi-size Windows .ico used by exe / installer / Electron
WIN_ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
FAVICON_SIZES = [16, 32, 48]

# macOS .icns type → pixel size
ICNS_ENTRIES = {
	"icp4": 16,
	"icp5": 32,
	"icp6": 64,
	"ic07": 128,
	"ic08": 256,
	"ic09": 512,
	"ic10": 1024,
	"ic11": 32,
	"ic12": 64,
	"ic13": 256,
	"ic14": 512,
}

# CSS: old code-icon.svg URL → logo PNG (idempotent if already swapped)
CSS_LOGO_SWAPS: list[tuple[str, str, str]] = [
	(
		"src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css",
		"url('../../../media/code-icon.svg')",
		"url('../../../media/logo_cube_noshadow.png')",
	),
	(
		"src/vs/workbench/browser/parts/banner/media/bannerpart.css",
		"url('../../../../browser/media/code-icon.svg')",
		"url('../../../../browser/media/logo_cube_noshadow.png')",
	),
	(
		"src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStarted.css",
		"url('../../../../browser/media/code-icon.svg')",
		"url('../../../../browser/media/logo_cube_noshadow.png')",
	),
	(
		"src/vs/workbench/contrib/welcomeWalkthrough/browser/media/walkThroughPart.css",
		"url('../../../../browser/media/code-icon.svg')",
		"url('../../../../browser/media/logo_cube_noshadow.png')",
	),
	(
		"src/vs/workbench/contrib/welcomeOnboarding/browser/media/variationA.css",
		"url('../../../../browser/media/code-icon.svg')",
		"url('../../../../browser/media/logo_cube_noshadow.png')",
	),
	(
		"src/vs/workbench/contrib/update/browser/media/updateTooltip.css",
		"url('../../../../browser/media/code-icon.svg')",
		"url('../../../../browser/media/logo_cube_noshadow.png')",
	),
	(
		"src/vs/sessions/browser/media/openInVSCode.css",
		"url('../../../workbench/browser/media/code-icon.svg')",
		"url('../../../workbench/browser/media/logo_cube_noshadow.png')",
	),
	(
		"src/vs/sessions/browser/media/openInVSCode.css",
		"url('./vscode-icon.svg')",
		"url('../../../workbench/browser/media/logo_cube_noshadow.png')",
	),
]

SVG_WRAPPER_TARGETS = [
	"src/vs/workbench/browser/media/code-icon.svg",
	"extensions/github-authentication/media/code-icon.svg",
	"src/vs/sessions/browser/media/vscode-icon.svg",
]


def rel(path: Path) -> str:
	try:
		return str(path.relative_to(ROOT))
	except ValueError:
		return str(path)


def square_rgba(
	im: Image.Image,
	size: int | None = None,
	pad_color: tuple[int, int, int, int] = (0, 0, 0, 0),
) -> Image.Image:
	"""Center image on a square RGBA canvas, optionally resize to ``size``."""
	im = im.convert("RGBA")
	side = max(im.size)
	canvas = Image.new("RGBA", (side, side), pad_color)
	canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
	if size is not None and side != size:
		canvas = canvas.resize((size, size), Image.Resampling.LANCZOS)
	return canvas


def save_png(im: Image.Image, path: Path, size: int) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	square_rgba(im, size).save(path, format="PNG", optimize=True)
	print(f"  PNG  {rel(path)} ({size}x{size})")


def save_ico(im: Image.Image, path: Path, sizes: list[int]) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	imgs = [square_rgba(im, s) for s in sorted(sizes, reverse=True)]
	imgs[0].save(path, format="ICO", sizes=[(s, s) for s in sizes], append_images=imgs[1:])
	print(f"  ICO  {rel(path)} sizes={sizes}")


def save_icns(im: Image.Image, path: Path) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	img = icnsutil.IcnsFile()
	for key, px in ICNS_ENTRIES.items():
		tmp = path.parent / f".tmp_{key}.png"
		square_rgba(im, px).save(tmp, format="PNG")
		img.add_media(key, file=str(tmp))
		tmp.unlink(missing_ok=True)
	img.write(str(path))
	print(f"  ICNS {rel(path)}")


def save_xpm(im: Image.Image, path: Path, size: int = 48) -> None:
	"""Adaptive-palette XPM for RPM packaging."""
	path.parent.mkdir(parents=True, exist_ok=True)
	sq = square_rgba(im, size).convert("P", palette=Image.Palette.ADAPTIVE, colors=64)
	rgba = sq.convert("RGBA")
	w, h = rgba.size
	pixels = list(rgba.getdata())
	chars = ".+@#$%&*=-;:,<>abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	cmap: dict[tuple[int, int, int, int], str] = {}
	ci = 0
	rows: list[str] = []
	for y in range(h):
		row: list[str] = []
		for x in range(w):
			key = pixels[y * w + x]
			if key not in cmap:
				cmap[key] = chars[ci % len(chars)] + chars[(ci // len(chars)) % len(chars)]
				ci += 1
			row.append(cmap[key])
		rows.append("".join(row))
	lines = [
		"/* XPM */",
		"static char * code_xpm[] = {",
		f'"{w} {h} {len(cmap)} 2",',
	]
	for (r, g, b, a), ch in cmap.items():
		if a < 128:
			lines.append(f'"{ch} c None",')
		else:
			lines.append(f'"{ch} c #{r:02x}{g:02x}{b:02x}",')
	for i, row in enumerate(rows):
		comma = "," if i < len(rows) - 1 else ""
		lines.append(f'"{row}"{comma}')
	lines.append("};")
	path.write_text("\n".join(lines) + "\n", encoding="ascii", errors="replace")
	print(f"  XPM  {rel(path)} ({size}x{size})")


def write_svg_png_wrapper(png_bytes: bytes, path: Path) -> None:
	"""SVG that embeds the PNG so existing .svg references show the brand mark."""
	path.parent.mkdir(parents=True, exist_ok=True)
	b64 = base64.b64encode(png_bytes).decode("ascii")
	svg = (
		'<?xml version="1.0" encoding="UTF-8"?>\n'
		'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
		'viewBox="0 0 1024 1024">\n'
		f'  <image width="1024" height="1024" xlink:href="data:image/png;base64,{b64}"/>\n'
		"</svg>\n"
	)
	path.write_text(svg, encoding="utf-8")
	print(f"  SVG  {rel(path)} (png-embedded)")


def apply_css_logo_swaps() -> None:
	for rel_path, old, new in CSS_LOGO_SWAPS:
		path = ROOT / rel_path
		if not path.is_file():
			print(f"  skip missing {rel_path}")
			continue
		text = path.read_text(encoding="utf-8")
		if new in text and old not in text:
			print(f"  CSS  {rel_path} (already branded)")
			continue
		if old not in text:
			print(f"  skip pattern missing: {rel_path}")
			continue
		path.write_text(text.replace(old, new), encoding="utf-8")
		print(f"  CSS  {rel_path}")


def main() -> int:
	if not SRC.is_file():
		print(f"error: missing source logo: {SRC}", file=sys.stderr)
		return 1

	src = Image.open(SRC)
	png_bytes = SRC.read_bytes()
	print(f"source: {rel(SRC)} ({src.size[0]}x{src.size[1]})")
	print("app branding only — language filetype icons left untouched\n")

	# --- Workbench in-app logo (exact PNG) ---
	media = ROOT / "src/vs/workbench/browser/media/logo_cube_noshadow.png"
	media.parent.mkdir(parents=True, exist_ok=True)
	media.write_bytes(png_bytes)
	print(f"  COPY {rel(media)}")

	# --- Windows app / installer / tiles ---
	save_ico(src, ROOT / "resources/win32/code.ico", WIN_ICO_SIZES)
	save_png(src, ROOT / "resources/win32/code_70x70.png", 70)
	save_png(src, ROOT / "resources/win32/code_150x150.png", 150)
	# Staging copy next to source
	save_ico(src, Path(__file__).resolve().parent / "code.ico", WIN_ICO_SIZES)

	# --- macOS app / DMG ---
	save_icns(src, ROOT / "resources/darwin/code.icns")

	# --- Linux desktop / RPM ---
	save_png(src, ROOT / "resources/linux/code.png", 512)
	save_xpm(src, ROOT / "resources/linux/rpm/code.xpm", 48)

	# --- Server / web / PWA ---
	save_ico(src, ROOT / "resources/server/favicon.ico", FAVICON_SIZES)
	save_png(src, ROOT / "resources/server/code-192.png", 192)
	save_png(src, ROOT / "resources/server/code-512.png", 512)

	# --- Generic "open with" document icon (not language-specific) ---
	save_ico(src, ROOT / "resources/win32/default.ico", WIN_ICO_SIZES)
	save_icns(src, ROOT / "resources/darwin/default.icns")

	# --- SVG wrappers for leftover code-icon.svg references ---
	print()
	for rel_path in SVG_WRAPPER_TARGETS:
		write_svg_png_wrapper(png_bytes, ROOT / rel_path)

	# --- CSS → PNG ---
	print()
	apply_css_logo_swaps()

	print("\ndone")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
