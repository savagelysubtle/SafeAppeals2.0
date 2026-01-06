# Floating Images Implementation - Quick Reference Card

## File Organization

```
your-project/
├── src/
│   ├── extensions/FloatingImage.ts
│   ├── utils/export-docx.ts
│   ├── components/RichTextEditor.tsx
│   ├── styles/floating-images.css
│   └── App.tsx
└── package.json
```

## Key Imports

```typescript
// Extension
import { FloatingImage } from "./extensions/FloatingImage";

// Export
import {
	exportTiptapToDocx,
	downloadBlob,
	mapWrapType,
	createFloatingImageOptions,
} from "./utils/export-docx";

// Component
import { RichTextEditor } from "./components/RichTextEditor";

// Styles
import "./styles/floating-images.css";
```

## Schema Attributes

| Attribute        | Type    | Default     | Values                                             |
| ---------------- | ------- | ----------- | -------------------------------------------------- |
| `wrapType`       | string  | `'square'`  | square, tight, through, topAndBottom, none, behind |
| `floatSide`      | string  | `'left'`    | left, right, center, none                          |
| `margin`         | number  | `8`         | 0-50 (pixels)                                      |
| `relativeHeight` | number  | `251658240` | Any number (z-order)                               |
| `behindDoc`      | boolean | `false`     | true/false                                         |

## Common Commands

```typescript
// Insert image
editor
	.chain()
	.focus()
	.insertContent({
		type: "floatingImage",
		attrs: { src, alt, wrapType: "square", floatSide: "left", margin: 8 },
	})
	.run();

// Update wrap type
editor.chain().focus().setWrapType("topAndBottom").run();

// Update float side
editor.chain().focus().setFloatSide("right").run();

// Update margin
editor.chain().focus().setImageMargin(12).run();

// Set behind text
editor.chain().focus().setBehindDoc(true).run();

// Export DOCX
const blob = await exportTiptapToDocx(editor.getJSON());
downloadBlob(blob, "document.docx");
```

## CSS Classes Generated

```
floating-image
├── floating-image-left
├── floating-image-right
├── floating-image-center
├── floating-image-none
├── floating-image-wrap-square
├── floating-image-wrap-tight
├── floating-image-wrap-through
├── floating-image-wrap-topAndBottom
├── floating-image-wrap-none
├── floating-image-behind
└── floating-image-front
```

## Data Attributes

```html
<figure
	data-wrap-type="square"
	data-float-side="left"
	data-margin="8"
	data-z-index="251658240"
	data-behind="false"
>
	<img src="image.jpg" />
</figure>
```

## OOXML Mapping

| Tiptap       | OOXML                          | Word Display          |
| ------------ | ------------------------------ | --------------------- |
| square       | `<wp:wrapSquare/>`             | Text wraps both sides |
| tight        | `<wp:wrapTight/>`              | Tight to image        |
| through      | `<wp:wrapThrough/>`            | Text flows through    |
| topAndBottom | `<wp:wrapTopAndBottom/>`       | Top and bottom only   |
| none         | `<wp:wrapNone/>`               | Over/under            |
| behind       | `<wp:wrapNone behindDoc="1"/>` | Behind text           |

## Testing Checklist

- [ ] Images display in editor
- [ ] Float left shows text on right
- [ ] Float right shows text on left
- [ ] Center displays as block
- [ ] Margin creates visible space
- [ ] DOCX exports without errors
- [ ] DOCX opens in Word
- [ ] Text wraps in Word
- [ ] All wrap types work
- [ ] Behind text appears muted

## Environment Variables (if using image upload)

```env
VITE_IMAGE_UPLOAD_URL=https://api.example.com/upload
VITE_STORAGE_BUCKET=my-bucket
```

## Performance

- Load images on-demand during export
- Cache fetched image buffers
- Use blob URLs for previews
- Stream large documents
- Clear cache between exports

## Browser Support

All modern browsers:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

```json
{
	"@tiptap/core": "^2.1.0",
	"@tiptap/react": "^2.1.0",
	"@tiptap/starter-kit": "^2.1.0",
	"@tiptap/extension-image": "^2.1.0",
	"docx": "^8.5.0"
}
```

## Helpful Links

- Spec: http://officeopenxml.com/drwPicFloating-textWrap.php
- API: https://docx.js.org
- Docs: https://tiptap.dev
- Anchor: https://learn.microsoft.com/dotnet/api/documentformat.openxml.drawing.wordprocessing.anchor
