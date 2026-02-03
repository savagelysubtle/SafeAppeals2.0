---
name: DOCX Ribbon Visual Refresh
overview: Improve the DOCX viewer ribbon styling to achieve a cleaner, more polished look similar to Microsoft Word, while preserving all existing functionality.
todos:
  - id: update-ribbon-tabs
    content: Update ribbon tab bar CSS for cleaner tab styling (sentence case, rounded corners, better active indicator)
    status: completed
  - id: update-ribbon-sections
    content: Improve ribbon section/group styling with subtle backgrounds and gradient separators
    status: completed
  - id: update-ribbon-buttons
    content: Refine button styles with better hover/active states and improved spacing
    status: completed
  - id: update-ribbon-dropdowns
    content: Polish dropdown select styling with better borders and focus states
    status: completed
  - id: add-ribbon-variables
    content: Add new CSS custom properties for ribbon section backgrounds and borders
    status: completed
  - id: test-dark-light-modes
    content: Verify all changes work correctly in both dark and light VS Code themes
    status: completed
isProject: false
---

# DOCX Ribbon Visual Refresh

## Current State Analysis

Looking at the screenshots, the current ribbon has several visual issues
compared to Word:

1. **Tab bar** - Flat appearance, basic styling, uppercase text looks dated
2. **Section groups** - Thin separators lack visual weight, labels too small
3. **Buttons** - Lack depth and dimensionality, hover states too subtle
4. **Dropdowns** - Very basic styling, missing polish
5. **Overall spacing** - Groups feel cramped, inconsistent padding

## Design Improvements

### 1. Refined Tab Bar Styling

Update
[docxViewer.css](src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/docxViewer.css)
ribbon-tabs:

- Remove uppercase text - use sentence case like Word
- Add subtle background gradient/color to active tab
- Improve hover states with soft background transition
- Increase padding for better clickability
- Use thicker, more prominent active indicator

### 2. Enhanced Section Groups

Improve `.ribbon-section` styling:

- Add subtle background color to create visual "wells"
- Use thicker, styled separators between groups (gradient fade)
- Increase section label size (10px) and opacity
- Add more horizontal padding for breathing room
- Create visual depth with very subtle inner shadow

### 3. Button Refinements

Update `.ribbon-btn` styles:

- Add subtle border on hover instead of full border always visible
- Improve active/pressed state with inset shadow effect
- Better icon/label spacing
- Slightly larger click targets
- More prominent hover background

### 4. Dropdown Improvements

Update `.ribbon-select` styles:

- Better border visibility in both light/dark modes
- Improved focus ring styling
- Slightly larger height for easier interaction
- Better dropdown arrow positioning

### 5. Overall Polish

- Increase minimum ribbon height for better proportions
- Add subtle bottom shadow to ribbon container
- Improve color picker button styling
- Better visual hierarchy between large/small buttons

## Files to Modify

| File                                                                                                    | Changes                                        |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [docxViewer.css](src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/docxViewer.css) | All ribbon CSS improvements (lines ~1267-1456) |

## Key CSS Changes

### Tab Bar (lines 1287-1318)

```css
.ribbon-tabs {
	padding: 4px 12px 0;
	gap: 2px;
	background: linear-gradient(
		to bottom,
		var(--vscode-editorGroupHeader-tabsBackground),
		var(--ribbon-bg)
	);
}

.ribbon-tab {
	padding: 6px 14px;
	border-radius: 4px 4px 0 0;
	text-transform: none; /* Remove uppercase */
	font-weight: 400;
	font-size: 13px;
	border-bottom: none;
}

.ribbon-tab.active {
	background: var(--vscode-editor-background);
	font-weight: 500;
	box-shadow: 0 -2px 0 var(--vscode-focusBorder) inset;
}
```

### Section Groups (lines 1336-1361)

```css
.ribbon-section {
	padding: 6px 16px;
	margin: 4px 0;
	background: var(--ribbon-section-bg);
	border-radius: 4px;
	border-right: none;
	margin-right: 8px;
}

.ribbon-section::after {
	/* Vertical separator between groups */
	content: "";
	position: absolute;
	right: -4px;
	height: 80%;
	width: 1px;
	background: linear-gradient(
		to bottom,
		transparent,
		var(--vscode-panel-border),
		transparent
	);
}

.ribbon-section-label {
	font-size: 10px;
	opacity: 0.7;
}
```

### Buttons (lines 1364-1409)

```css
.ribbon-btn {
	border-radius: 4px;
	border: 1px solid transparent;
	min-height: 36px;
}

.ribbon-btn:hover {
	background: var(--vscode-list-hoverBackground);
	border-color: var(--vscode-widget-border);
}

.ribbon-btn:active,
.ribbon-btn.active {
	background: var(--vscode-list-activeSelectionBackground);
	box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.ribbon-btn-small {
	min-width: 30px;
	min-height: 30px;
	border-radius: 4px;
}
```

### Dropdowns (lines 1411-1435)

```css
.ribbon-select {
	height: 28px;
	border-radius: 4px;
	padding: 0 28px 0 10px;
	border: 1px solid var(--vscode-widget-border);
}

.ribbon-select:hover {
	border-color: var(--vscode-focusBorder);
}
```

## Visual Hierarchy

The improved ribbon will have clearer visual zones:

```
+------------------------------------------------------------------+
|  Home   Insert   Layout                          (Tab Bar)       |
+------------------------------------------------------------------+
| [File] | [Undo] | [Font+Size] [B I U S] | [Align] [Lists] | ...  |
|  File  |  Undo  |          Font         |    Paragraph    | ...  |
+------------------------------------------------------------------+
```

- Tabs: Clean, sentence-case, subtle active indicator
- Groups: Rounded background wells with faded separators
- Buttons: Clear hover/active states with better spacing
- Labels: Slightly larger, better readability

## Testing

After changes, verify in the app that:

1. Tab switching still works
2. All button hover/active states look correct in both light/dark modes
3. Dropdowns function properly
4. No layout shifts or broken styling
