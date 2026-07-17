---
name: Audio Recorder UI Redesign
overview: Redesign the audio recorder controls to have a prominent central circular Record button (always red, pulsing when recording) with rectangular labeled buttons for Import and Pause/Resume on either side.
todos:
  - id: update-button-styles
    content: Update RecordingControls.tsx with new labeled button styles and larger Record button
    status: completed
  - id: add-pulsing-animation
    content: Add enhanced pulsing animation for recording state
    status: completed
  - id: update-button-layout
    content: Restructure button layout with labeled Import/Pause buttons and centered Record button
    status: completed
  - id: add-hover-states
    content: Add hover states for labeled buttons
    status: completed
  - id: add-button-labels
    content: Add optional 'Record'/'Stop' label below the circular button
    status: completed
  - id: rebuild-and-test
    content: Rebuild React components and test the new UI
    status: completed
isProject: false
---

# Audio Recorder UI Redesign

## Current State

The `RecordingControls.tsx` component uses three circular buttons without text
labels:

- 44px gray circle (Import - folder icon)
- 56px red circle (Record/Stop - circle/square icon)
- 44px gray circle (Pause/Resume - pause/play icon)

Users have no clear indication of what each button does without hovering for
tooltips.

## Design Goals

1. **Prominent central Record button** - Large circular, always red, pulsing
   when active
2. **Labeled side controls** - Rectangular buttons with icon + text for Import
   and Pause
3. **Clear visual hierarchy** - Record is the primary action, others are
   secondary
4. **Consistent with app styling** - Match Timeline toolbar button patterns

## Visual Layout

```
+------------------+     +-------------+     +------------------+
|  [folder] Import |     |     [O]     |     | [||] Pause       |
+------------------+     |   RECORD    |     +------------------+
                         |   (64px)    |
                         +-------------+
```

When recording:

```
+------------------+     +-------------+     +------------------+
|  [folder] Import |     |  [square]   |     | [||] Pause       |
|    (disabled)    |     |    STOP     |     +------------------+
+------------------+     |  (pulsing)  |
                         +-------------+
```

## Implementation Changes

### File: [RecordingControls.tsx](src/vs/workbench/contrib/void/browser/react/src/audio-recorder-tsx/RecordingControls.tsx)

**1. Update button styles:**

Replace `secondaryButtonStyle` (circular) with rectangular labeled style:

```typescript
const labeledButtonStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-button-secondaryBackground)",
	color: "var(--vscode-button-secondaryForeground)",
	border: "1px solid var(--vscode-panel-border)",
	borderRadius: "8px",
	padding: "8px 16px",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	gap: "8px",
	fontSize: "13px",
	fontWeight: 500,
	transition: "background-color 0.2s, border-color 0.2s",
};
```

**2. Increase Record button size:**

Change from 56px to 64px for more prominence:

```typescript
const recordButtonStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-charts-red)",
	color: "white",
	border: "none",
	borderRadius: "50%",
	width: "64px",
	height: "64px",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
	transition: "transform 0.1s, box-shadow 0.2s",
};
```

**3. Add pulsing animation for recording state:**

Enhance the existing keyframes:

```typescript
const styleSheet = `
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
  50% { opacity: 0.9; transform: scale(1.05); box-shadow: 0 4px 20px rgba(239, 68, 68, 0.5); }
}
@keyframes recordPulse {
  0%, 100% { box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 4px 24px rgba(239, 68, 68, 0.6); }
}
`;
```

**4. Update button layout structure:**

Change from simple row to flex with centered record button:

```tsx
<div style={buttonRowStyle}>
	{/* Left: Import Button */}
	<button
		style={labeledButtonStyle}
		onClick={onShowImporter}
		disabled={!isIdle}
	>
		<i className="codicon codicon-folder-opened" />
		<span>Import</span>
	</button>

	{/* Center: Record/Stop Button */}
	<button
		style={{
			...recordButtonStyle,
			animation: isRecording ? "recordPulse 1.5s ease-in-out infinite" : "none",
		}}
		onClick={isIdle ? onStart : onStop}
	>
		<i
			className={`codicon ${isIdle ? "codicon-circle-filled" : "codicon-primitive-square"}`}
		/>
	</button>

	{/* Right: Pause/Resume Button */}
	<button
		style={{
			...labeledButtonStyle,
			opacity: isIdle ? 0.5 : 1,
		}}
		onClick={isPaused ? onResume : onPause}
		disabled={isIdle}
	>
		<i
			className={`codicon ${isPaused ? "codicon-play" : "codicon-debug-pause"}`}
		/>
		<span>{isPaused ? "Resume" : "Pause"}</span>
	</button>
</div>
```

**5. Add hover states for labeled buttons:**

Use `onMouseEnter`/`onMouseLeave` for hover effect:

```typescript
onMouseEnter={(e) => {
  e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground)';
  e.currentTarget.style.borderColor = 'var(--vscode-focusBorder)';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
  e.currentTarget.style.borderColor = 'var(--vscode-panel-border)';
}}
```

**6. Optional: Add label under Record button:**

Show "Record" or "Stop" text below the button:

```tsx
<div
	style={{
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: "4px",
	}}
>
	<button style={recordButtonStyle}>...</button>
	<span
		style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)" }}
	>
		{isIdle ? "Record" : "Stop"}
	</span>
</div>
```

## Before/After Comparison

| Aspect           | Before                 | After                              |
| ---------------- | ---------------------- | ---------------------------------- |
| Import button    | 44px circle, icon only | Rectangular, icon + "Import"       |
| Record button    | 56px red circle        | 64px red circle, pulsing animation |
| Pause button     | 44px circle, icon only | Rectangular, icon + "Pause/Resume" |
| Visual hierarchy | All similar size       | Clear primary/secondary            |
| Accessibility    | Tooltip only           | Visible labels                     |

## Testing

After implementation:

1. Run `bun run buildreact` to rebuild React components
2. Reload window (`Ctrl+Shift+P` -> "Developer: Reload Window")
3. Open Audio Recorder panel
4. Verify button labels are visible
5. Test recording flow (Start -> Pause -> Resume -> Stop)
6. Verify pulsing animation during recording
7. Check disabled states for Import/Pause when not applicable
