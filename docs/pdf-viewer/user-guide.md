# PDF Viewer User Guide

## Opening a PDF

Click any `.pdf` file in the File Explorer or open it via **File → Open File**. The PDF viewer opens automatically in an editor tab.

The viewer uses the PDFium rendering engine (the same used by Google Chrome) for accurate, high-fidelity display.

---

## Navigating Pages

### Toolbar Buttons

| Button | Action |
|---|---|
| **Previous** | Go to the previous page |
| **Next** | Go to the next page |

The current page number and total page count are displayed between the navigation buttons: `Page 3 of 47`.

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `←` or `↑` | Previous page |
| `→` or `↓` | Next page |

### Sidebar Thumbnails

The left sidebar shows a **Thumbnails** tab with small preview images of every page. Click any thumbnail to jump directly to that page. The currently active thumbnail is highlighted and scrolled into view automatically.

### Session Persistence

The viewer remembers which page you were on. When you close and reopen a PDF, it automatically returns to your last-viewed page.

---

## Zooming

### Toolbar Buttons

| Button | Action |
|---|---|
| **Zoom In** | Increase zoom by 20% |
| **Zoom Out** | Decrease zoom by 20% |

### Ctrl + Mouse Wheel

Hold **Ctrl** (or **Cmd** on Mac) and scroll the mouse wheel up/down to zoom in/out. Zoom is clamped to a range of **0.5×–3.0×**.

---

## Sidebar

Toggle the sidebar open/closed with the **☰** button in the sidebar header. The sidebar has three tabs:

### Thumbnails Tab

Page preview images. Click any to navigate to that page.

### Outline Tab

The document's table of contents, automatically extracted from PDF bookmark metadata. Click any entry to jump to that section. If the PDF has no bookmarks, this tab shows "No outline available".

### Bookmarks Tab

Your personal bookmarks created within this viewer. See [Bookmarks](#bookmarks) below.

---

## Text Selection and Copying

The viewer places an invisible text layer over the rendered PDF. You can:
- **Click and drag** to select text on any page
- **Ctrl+C** to copy the selected text to clipboard

The selected text can also be used with **Ctrl+K** AI quick-edit features.

---

## Highlight Annotations

Select text on the page, then click one of the colored highlight buttons in the toolbar:

| Button | Color |
|---|---|
| 🖍️ (yellow) | Yellow highlight |
| 🖍️ (green) | Green highlight |
| 🖍️ (blue) | Blue highlight |
| 🖍️ (pink) | Pink highlight |

To **delete a highlight**: click the highlight to select it (it gets a blue outline), then click the **🗑️** (delete) button in the annotation toolbar.

Annotations persist across sessions — they are saved in workspace storage and restored whenever you open the same PDF.

> **Tip**: Highlights are stored as overlays, not embedded in the PDF file. They will not appear when the PDF is opened in another application.

---

## Bookmarks

Bookmarks are named markers for specific pages.

### Adding a Bookmark

1. Navigate to the page you want to bookmark
2. Click **+ Add Bookmark** in the Bookmarks tab of the sidebar
3. Enter a name in the prompt dialog

### Navigating to a Bookmark

Click any bookmark item in the Bookmarks tab to jump to that page.

### Deleting a Bookmark

Click the **×** button next to a bookmark item.

---

## Signatures

The viewer includes a built-in signature tool for placing visual signatures on PDF pages.

> **Note**: Signatures placed this way are visual overlays, not cryptographic digital signatures. For legal e-signatures, use the DocuSign integration.

### Creating a Signature

1. Click **✍️ Signature** in the toolbar
2. The signature modal opens with two modes:
   - **Draw**: Freehand draw with mouse or touch
   - **Type**: Type your name and choose a cursive style and font size

### Draw Mode

- Click and drag on the white canvas to draw
- Release the mouse to finish a stroke
- Click **Clear** to start over

### Type Mode

- Type your name in the text input
- Choose a style from the dropdown: Classic Script, Elegant Cursive, Modern Script, or Bold Signature
- Adjust font size with the slider (20–80 px)

### Placing a Signature

1. Click **Done** — the modal closes and the cursor changes to a crosshair
2. Click anywhere on the PDF page to place the signature
3. The signature appears at the clicked location

### Moving and Resizing a Signature

After placing a signature:
- **Hover** over it to select it (blue outline appears)
- **Click and drag** the signature to move it
- **Drag any of the 8 handles** (corners and edge midpoints) to resize it

### Right-Click Context Menu

Right-click a placed signature to open a context menu with a **Delete Signature** option.

### Saving Signatures for Reuse

In the signature modal, click **Save Signature** to store the current signature. Saved signatures appear in the **Saved Signatures** section at the bottom of the modal.

Click a saved signature image to load it back into the drawing canvas. Click **×** next to a saved signature to delete it permanently.

---

## Printing

Click **🖨️ Print** in the toolbar, or press **Ctrl+P** (Cmd+P on Mac).

This opens the original PDF file in your system's default browser, which has native, high-quality PDF print support.

> **Note**: In-viewer annotations and placed signatures are not included in the printed output — only the original PDF content is printed.

---

## DocuSign E-Signature

If your workspace has DocuSign configured, you can send the current PDF for e-signature:

1. Click **📧 DocuSign** in the toolbar
2. If not signed in, you will see a notification to configure DocuSign in **Settings → DocuSign**
3. Once signed in, the DocuSign signature flow begins

For DocuSign setup, see your workspace administrator.

---

## Troubleshooting

### The PDF shows a blank page

- The page may still be loading. Wait a moment for WASM initialization (first open may take a few seconds).
- Check the browser console (Help → Toggle Developer Tools) for WASM errors.

### Text is not selectable

- Some PDFs (scanned images, certain font encodings) may not have selectable text. The viewer attempts three text extraction strategies but cannot reconstruct text from pure image PDFs.

### Annotations are not appearing

- Annotations are per-file and per-workspace. If you moved the PDF file, the annotations may be associated with the old URI.

### Signatures look blurry after resizing

- Signatures are stored as PNG images. Scaling up beyond the original draw size reduces quality. For best results, draw signatures at the intended display size.

### The viewer is slow with a large PDF

- Open **Settings** and look for the PDF Preload Strategy setting. Changing from `all` to `adjacent` will reduce upfront rendering work for large documents.
