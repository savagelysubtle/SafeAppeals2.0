---
name: Image Resize Feature
overview: Add drag-to-resize functionality for images in the DOCX viewer by integrating the `tiptap-extension-resize-image` npm package, which provides corner drag handles for intuitive image resizing.
todos:
  - id: install-pkg
    content: Install tiptap-extension-resize-image npm package
    status: completed
  - id: update-entry
    content: Update tiptapBundleEntry.js to import/export ImageResize
    status: completed
    dependencies:
      - install-pkg
  - id: rebuild-bundle
    content: Rebuild webpack bundle with new extension
    status: completed
    dependencies:
      - update-entry
  - id: update-bundle
    content: Update tiptapBundle.js to use ImageResize in getExtensions()
    status: completed
    dependencies:
      - rebuild-bundle
  - id: add-css
    content: Add CSS styling for resize handles
    status: completed
    dependencies:
      - update-bundle
  - id: copy-files
    content: Copy updated files to out/ directory
    status: completed
    dependencies:
      - add-css
  - id: test
    content: Test image resize functionality
    status: completed
    dependencies:
      - copy-files
isProject: false
---

# Image Drag-to-Resize Implementation

## Approach

Use the `tiptap-extension-resize-image` npm package to replace the standard Image extension. This package:

- Provides corner resize handles when clicking on an image
- Works with VanillaJS (no React/Vue required)
- Maintains aspect ratio by default
- Supports image alignment

## Files to Modify

1. **[tiptapBundleEntry.js](src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/tiptapBundleEntry.js)**

- Replace `@tiptap/extension-image` import with `tiptap-extension-resize-image`
- Export as `window.TiptapImageResize`

2. **[tiptapBundle.js](src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/tiptapBundle.js)**

- Update `getExtensions()` to use `ImageResize` instead of `Image`
- Configure resize options (minWidth, minHeight, aspect ratio)

3. **[docxViewer.css](src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/docxViewer.css)**

- Add CSS for resize handles styling

## Implementation Steps

1. Install the package: `bun add tiptap-extension-resize-image`
2. Update webpack entry to import and export the resize extension
3. Rebuild webpack bundle: `npx webpack --config webpack.docx.config.cjs`
4. Update tiptapBundle.js to use the new extension
5. Add styling for resize handles
6. Copy files to out/ directory
7. Test resize functionality

## Notes

- This replaces the standard Image extension (they cannot coexist)
- Resize handles appear when clicking on an image
- Drag from corners to resize while maintaining aspect ratio
