Perplexity Research Questions

1. docx-preview Library Image Handling
   > "How does the docx-preview JavaScript library (docxjs) extract and render images from DOCX files? What format does it use for image src attributes (Base64 data URLs, Blob URLs, or external URLs)? What are the available options like useBase64URL and how do they affect image output? How can we access the original image binary data and dimensions before HTML rendering?"
   > Why I need this: The docx-preview library is our DOCX→HTML converter. I see conflicting options in the code (useBase64URL: true in one place, no option in another). Understanding exactly what it outputs will help us design the correct pipeline.
2. ProseMirror/Tiptap Image Node Schema Design
   > "What is the recommended ProseMirror or Tiptap schema design for image nodes that need to persist large image data? Should images be defined as inline nodes (inside paragraphs) or block nodes? How do production applications handle the trade-off between inline images (common in Word documents) and block images (simpler schema)? Provide examples of image node schema with proper attribute parsing for width, height, and src."
   > Why I need this: Our current image node is inline: true which matches Word's behavior (images inside paragraphs), but this complicates the DOCX round-trip. Need to know the best practice.
3. Browser Memory Management for Large Base64 Strings
   > "How does JavaScript and the browser garbage collector handle large Base64 strings (1-10MB each) stored in memory? What happens when Base64 image data is stored in a JavaScript object (like Tiptap's JSON state)? How do references work - if the same Base64 string is referenced in multiple places (JSON state, DOM img src), does the browser deduplicate or create copies? What are strategies to minimize memory usage when working with multiple large images in a rich text editor?"
   > Why I need this: The "memory explosion" issue might be caused by multiple copies of the same Base64 data. Understanding browser memory semantics will help us optimize.
4. Extracting Image Dimensions from Binary Data
   > "How can you extract the original pixel dimensions (width and height) from image binary data or Base64 data URLs in JavaScript without fully decoding the image? Provide code examples for reading PNG, JPEG, and GIF header bytes to extract dimensions. What is the performance impact of using new Image() and waiting for onload vs parsing headers directly? How do libraries like Sharp or Jimp handle dimension extraction?"
   > Why I need this: When converting Tiptap JSON back to DOCX, we need accurate image dimensions. Currently we're using node.attrs.width/height which may be null or incorrect. We need to read dimensions from the actual image data.
5. DOCX Round-Trip Image Preservation
   > "What is the complete workflow for preserving images when round-tripping a DOCX document through a web-based editor (load → edit → save)? Specifically, how should images extracted from an input DOCX be stored during editing, and how should they be re-embedded into the output DOCX? How do commercial web-based Word editors (like Google Docs, OnlyOffice, or Collabora) handle image persistence without data loss? What are the common failure modes and how are they prevented?"
   > Why I need this: We need to understand the full lifecycle to ensure no images are lost. This is the core problem we're trying to solve.

1a
Now I'll generate the comprehensive final report.

## Image Extraction and Rendering in docx-preview (docxjs)

The docx-preview library (npm package `docx-preview`, GitHub: `VolodymyrBaydalka/docxjs`) is a specialized DOCX renderer that converts Word documents into HTML with semantic preservation. Here's how it handles image extraction, rendering, and the available configuration options.

### Image Src Attribute Formats and the useBase64URL Option

The library offers two distinct strategies for rendering images via the **`useBase64URL`** configuration option:[1]

**Default Mode (useBase64URL: false) — Blob URLs**

When `useBase64URL` is set to `false` (the default), docxjs uses `URL.createObjectURL()` to create temporary blob object URLs. These appear as: `blob:http://localhost:3000/a1b2c3d4-e5f6-7890`. This approach is more efficient because:

- Minimal memory overhead (~1/3 the size of Base64 equivalents)[2]
- Faster rendering on Firefox and Safari[3]
- Allows lazy loading and efficient garbage collection
- URLs are kept in browser memory only during page session

The trade-off is that blob URLs are temporary—they become invalid after page navigation or reload and cannot be serialized.

**Base64 Mode (useBase64URL: true) — Data URIs**

When enabled, images are converted to Base64-encoded data URIs: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...`. This format:

- Can be embedded directly in HTML and serialized (localStorage, databases)
- Is universally supported across all browsers
- Increases DOM size by ~30% due to Base64 encoding overhead[2]
- Performs comparably to blob URLs on Chrome but slower on Firefox[3]
- Persists even after page reload or navigation

### How Images Are Extracted from DOCX Files

DOCX files are ZIP archives containing XML and binary media. The structure is:

```
document.docx (ZIP archive)
├── word/
│   ├── document.xml          (document structure with image references)
│   ├── document.xml.rels     (relationships mapping image IDs to media)
│   └── media/
│       ├── image1.jpg        (actual binary image files)
│       ├── image2.png
│       └── ...
├── [Content_Types].xml
└── ...
```

Docxjs internally uses JSZip (a JavaScript ZIP library) to decompress the DOCX and extract images. The rendering process follows this workflow:

1. **JSZip loads the DOCX** as a Blob or ArrayBuffer
2. **document.xml is parsed** to find `<w:drawing>` elements (inline) or `<wp:anchor>` elements (floating images)
3. **Relationships are resolved** via document.xml.rels to map image relationship IDs (`rId`) to actual media file paths
4. **Media binary is extracted** from `word/media/imageN.*` using JSZip's async file methods
5. **Image src attributes are generated** based on the useBase64URL option

### Internal Image Rendering Process

The library handles two types of image embeddings in OpenXML:

**Inline Images** — Embedded as `<wp:inline>` within text runs

- Dimensions stored in EMU (English Metric Units): 914,400 EMUs = 1 inch
- Render as normal HTML `<img>` elements, affecting line height and layout

**Floating/Anchored Images** — Embedded as `<wp:anchor>` elements

- Include positioning information (absolute or relative to page/paragraph)
- Can have text wrapping, margin distances, and z-order positioning
- Rendered with CSS positioning (typically `position: absolute` or styled containers)

The library extracts the width/height from the OpenXML extent properties and applies them to the rendered HTML image via CSS or inline styles.

### Accessing Original Image Binary Data and Dimensions

While docxjs's main public API (`renderAsync`) outputs rendered HTML, developers can access raw image data using the **experimental internal API**:[1]

```javascript
// Step 1: Parse the DOCX into a WordDocument object
const wordDoc = await docx.parseAsync(docxBlob, options);

// Step 2: Manually extract images via JSZip
import JSZip from "jszip";

const zip = new JSZip();
await zip.loadAsync(docxBlob);

// Step 3: Access image binary data
const imageUint8Array = await zip
	.file("word/media/image1.jpg")
	.async("uint8array");
const imageBlobUrl = URL.createObjectURL(
	new Blob([imageUint8Array], { type: "image/jpeg" })
);

// Or get Base64
const imageBase64 = await zip.file("word/media/image1.jpg").async("base64");
const dataUri = `data:image/jpeg;base64,${imageBase64}`;
```

For image dimensions, you can:

1. **From HTML rendering** — After rendering, query the DOM:

```javascript
const img = document.querySelector("img");
const width = img.naturalWidth; // original image dimensions
const height = img.naturalHeight;
```

2. **From OpenXML parsing** — Access extent properties before rendering (requires examining the parsed WordDocument structure, which is internal API and not officially documented)

3. **From image metadata** — The browser can determine dimensions once the image loads:

```javascript
const img = new Image();
img.onload = () => {
	console.log(`Width: ${img.naturalWidth}, Height: ${img.naturalHeight}`);
};
img.src = imageBlobUrl;
```

### Configuration Options Summary

| Option                         | Type    | Default | Impact                                                  |
| ------------------------------ | ------- | ------- | ------------------------------------------------------- |
| `useBase64URL`                 | boolean | `false` | Controls src format: blob URL vs Base64 data URI        |
| `ignoreFonts`                  | boolean | `false` | Also affects font embedding (can impact image handling) |
| `ignoreWidth` / `ignoreHeight` | boolean | `false` | Disables page/image width/height constraints            |
| `breakPages`                   | boolean | `true`  | Affects layout and image positioning across pages       |
| `debug`                        | boolean | `false` | Enables logging of image extraction process             |

### Performance and Memory Considerations

**For most use cases**, stick with the default `useBase64URL: false` because:

- Blob URLs consume 3x less memory than Base64 equivalents[2]
- Faster rendering on Firefox and Safari[3]
- Automatic garbage collection when images are removed from DOM

**Use `useBase64URL: true` only when:**

- You need to serialize images (save to database, localStorage)
- You require guaranteed browser compatibility for older browsers
- Memory is not a constraint
- Images need to persist after page reload

### Accessing Images Before HTML Rendering

The `parseAsync(document, options)` function returns a `WordDocument` object containing the document's internal structure. However, this API is marked as **experimental and unstable**, with the library maintainer noting that "inner implementation of parsing and rendering may be changed at any point".[1]

For production code requiring pre-rendering image access, the recommended approach is to:

1. Use JSZip directly to load and extract images
2. Process them independently
3. Then call `renderAsync()` for the document rendering

This avoids relying on docxjs's internal APIs that may change in future versions.

---

https://www.npmjs.com/package/docx-preview[1]
https://www.bennadel.com/blog/2966-rendering-image-previews-using-object-urls-vs-base64-data-uris-in-angularjs.htm[2]
https://www.andygup.net/performance-comparison-between-readasdataurl-and-createobjecturl/[3]

[1](https://stackoverflow.com/questions/27957766/how-do-i-render-a-word-document-doc-docx-in-the-browser-using-javascript)
[2](https://www.npmjs.com/package/docx-preview)
[3](https://forum.jsreport.net/topic/1821/docximage-not-rendering-base64-image-sent-over-api-instead-outputs-base64-json)
[4](https://learn.microsoft.com/en-gb/answers/questions/1324557/is-word-document-read-base64-image-format)
[5](https://github.com/evidenceprime/html-docx-js/issues/2)
[6](https://stackoverflow.com/questions/79705723/why-docx-preview-js-in-not-rendering-docx-file-properly)
[7](https://www.reddit.com/r/learnjavascript/comments/d1ocm5/how_to_use_urlcreateobjecturl_for_blob_images/)
[8](https://stackoverflow.com/questions/53342136/encode-docx-file-to-base64-in-javascript)
[9](https://github.com/dolanmiu/docx/issues/311)
[10](https://www.reddit.com/r/reactjs/comments/7prkrq/library_for_rendering_preview_images_of_documents/)
[11](https://stackoverflow.com/questions/73489743/how-to-convert-image-src-url-to-blob)
[12](https://learn.microsoft.com/en-us/javascript/api/word/word.insertfileoptions?view=word-js-preview)
[13](https://github.com/microsoft/markitdown/issues/58)
[14](https://kb.groupdocs.cloud/viewer/nodejs/render-docx-to-jpg-using-nodejs-rest-api/)
[15](https://pqina.nl/blog/convert-an-image-to-a-base64-string-with-javascript/)
[16](https://ionic.io/blog/converting-a-base64-string-to-a-blob-in-javascript)
[17](http://13.232.111.123/docxpreviewjs-a-Word-document-depending-on)
[18](https://github.com/cline/cline/issues/7233)
[19](https://javascript.info/blob)
[20](https://www.nutrient.io/guides/web/open-a-document/office-from-base64-data/)
[21](https://stackoverflow.com/questions/60534110/how-to-tell-docx-js-to-use-an-images-natural-height-and-width)
[22](https://www.dowst.dev/extracting-images-from-word/)
[23](https://ourcodeworld.com/articles/read/38/how-to-capture-an-image-from-a-dom-element-with-javascript)
[24](https://github.com/dolanmiu/docx/blob/master/docs/usage/images.md)
[25](https://community.spiceworks.com/t/extract-images-from-docx/1009499)
[26](https://stackoverflow.com/questions/10721884/how-to-render-html-to-an-image)
[27](https://github.com/VolodymyrBaydalka/docxjs)
[28](https://www.youtube.com/watch?v=RxAsGZPG9Aw)
[29](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement)
[30](https://www.aspsnippets.com/questions/642755/display-binary-word-document-docx-from-database-in-browser-using-javascript-in-aspnet/answers)
[31](https://www.mathworks.com/matlabcentral/answers/463326-how-do-i-extract-images-from-a-docx-word-file)
[32](https://github.com/VolodymyrBaydalka/docxjs/discussions/184)
[33](https://stackoverflow.com/questions/6150289/how-can-i-convert-an-image-into-base64-string-using-javascript)
[34](https://deparkes.co.uk/2016/12/23/how-word-files-store-images/)
[35](https://www.skypack.dev/view/docx-preview)
[36](https://forum.aspose.com/t/how-to-get-images-from-word-media-folder-of-docx-using-java/207665)
[37](https://stackoverflow.com/questions/63042495/how-can-i-output-a-docx-from-docxtemplater-js-for-input-in-jszip)
[38](https://pqina.nl/blog/convert-a-file-to-a-base64-string-with-javascript/)
[39](https://github.com/dolanmiu/docx/issues/9)
[40](https://stackoverflow.com/questions/72826550/how-to-put-docx-in-jszip)
[41](https://www.youtube.com/watch?v=EPlXPdNvQEY)
[42](https://jsreport.net/learn/docx)
[43](https://stuk.github.io/jszip/documentation/upgrade_guide.html)
[44](https://www.codexworld.com/how-to/get-image-original-dimensions-width-height-using-javascript/)
[45](https://stackoverflow.com/questions/56490771/how-to-add-anchor-images-in-open-xml-wordprocessing-document)
[46](https://www.youtube.com/watch?v=7AgF6dPuTPE)
[47](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.wordprocessing.anchor?view=openxml-3.0.1)
[48](https://www.w3schools.com/jsref/prop_img_naturalwidth.asp)
[49](https://support.microsoft.com/en-au/topic/wd-how-to-extract-embedded-images-from-a-word-document-f478bf7f-3bba-6afb-6ddc-3eeb284af36b)
[50](http://www.docx4java.org/forums/docx-java-f6/how-to-create-a-floating-image-t1224.html)
[51](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalHeight)
[52](https://www.reddit.com/r/MicrosoftWord/comments/14l8wim/embedded_documents_in_a_word_file_converted_to/)
[53](https://python-docx.readthedocs.io/en/latest/dev/analysis/features/shapes/shapes-inline.html)
[54](https://github.com/dolanmiu/docx/issues/2545)
[55](https://javascript.plainenglish.io/render-dynamically-a-docx-file-with-javascript-daaed816fcb8)
[56](https://github.com/dolanmiu/docx/wiki/Positioning-of-Images)
[57](https://learn.microsoft.com/en-us/aspnet/core/blazor/images-and-documents?view=aspnetcore-10.0)
[58](https://www.youtube.com/watch?v=WOveCgKuJOI)
[59](https://github.com/millet0328/docx-preview-sync)
[60](https://github.com/python-openxml/python-docx/issues/94)
[61](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer)
[62](https://www.npmjs.com/package/html-docx-js-typescript)
[63](https://stackoverflow.com/questions/69557897/how-to-extract-images-from-word-using-media-extract-in-r)
[64](https://github.com/docling-project/docling/issues/2225)
[65](https://github.com/alonrbar/easy-template-x/issues/4)
[66](https://blog.openize.com/document/extract-images-from-ms-word-document-using-csharp/)
[67](https://stuk.github.io/jszip/documentation/api_jszip/file_data.html)
[68](https://www.cjoshmartin.com/blog/creating-zip-files-with-javascript)
[69](https://github.com/dolanmiu/docx/issues/1162)
[70](https://dev.to/allen_yang_f905170c5a197b/automating-image-extraction-from-docx-files-with-python-533f)
[71](https://stuk.github.io/jszip/documentation/examples.html)
[72](https://support.microsoft.com/en-us/topic/wd-how-to-extract-embedded-images-from-a-word-document-f478bf7f-3bba-6afb-6ddc-3eeb284af36b)
[73](https://stuk.github.io/jszip/documentation/api_zipobject/async.html)
[74](https://stackoverflow.com/questions/31742072/filereader-vs-window-url-createobjecturl)
[75](https://github.com/Stuk/jszip/issues/355)
[76](https://stackoverflow.com/questions/72009019/preview-xlsx-docx-etc-file-blob-url-in-iframe-without-download-using-angular-6)
[77](https://www.andygup.net/performance-comparison-between-readasdataurl-and-createobjecturl/)
[78](https://www.reddit.com/r/node/comments/179rcve/how_to_preview_the_word_document_on_web_browser/)
[79](https://www.reddit.com/r/javascript/comments/1cwt2px/askjs_performance_between_blob_vs_url_to_display/)
[80](https://stuk.github.io/jszip/documentation/api_jszip/load_async.html)
[81](https://www.jsdelivr.com/package/npm/docx-preview-sign)
[82](https://www.bennadel.com/blog/2966-rendering-image-previews-using-object-urls-vs-base64-data-uris-in-angularjs.htm)
[83](https://stackoverflow.com/questions/31298948/load-image-with-filereader-api-and-zip-it-using-jszip)
[84](https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html)
[85](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img)
[86](https://stuk.github.io/jszip/documentation/howto/read_zip.html)
[87](https://help.micro.blog/t/customize-img-rendering-using-markdown-render-hooks/1372)
[88](https://andyinthecloud.com/2012/11/04/handling-office-files-and-zip-files-in-apex-part-1/)
[89](https://discuss.prosemirror.net/t/modifying-an-imgs-src-before-its-rendered/171)
[90](https://github.com/Stuk/jszip/issues/447)
2a
Perfect! Now let me create a final summary response for you:

---

## Summary

I've created a comprehensive guide to ProseMirror/Tiptap image node schema design with four detailed documents tailored to your SafeAppeals Navigator use case:

### 📋 **Files Created**

1. **`QUICK_REFERENCE.md`** - Start here (TL;DR decision tree, copy-paste schemas, debugging)
2. **`image_node_schema_guide.md`** - Deep dive (architecture decisions, block vs inline trade-offs, production patterns)
3. **`tiptap_image_implementation.ts`** - Production-ready TypeScript (fully commented, copy-paste ready)
4. **`image_node_styling_integration.md`** - CSS, React/Vue examples, server endpoints, accessibility

---

## 🎯 **Key Findings for SafeAppeals Navigator**

### **Decision: Block Images (Recommended)**

- **Block nodes** are the default in Tiptap and production standard (Notion, Google Docs, Medium)
- ✅ Simpler schema, better resize controls, cleaner selection behavior
- ❌ Images always get their own line (no text wrapping)
- Only use **inline** if importing Word documents with text-wrapped images

### **Image Data Persistence: Store URLs Only**

```typescript
❌ DON'T embed base64:
src: "data:image/jpeg;base64,/9j/4AAQSkZIRg..." // 33% larger, bloats document

✅ DO store CDN URLs:
src: "https://cdn.example.com/uuid/image.webp"   // Fast, cacheable, small
```

### **Attribute Schema** (width, height, src)

```typescript
// Required attributes for production use
src: string; // HTTPS CDN URL only
alt: string; // Accessibility (WCAG)
width: number | null; // Pixels (must parse from string)
height: number | null; // Pixels (must parse from string)
aspectRatio: number | null; // width ÷ height (for resize lock)
```

### **Production Upload Flow**

1. User uploads/pastes image → send to `/api/images/upload`
2. Server: Validate, compress (Sharp), convert to WebP, upload to S3/Supabase
3. Server returns: `{ url, width, height }`
4. Client: Insert with `editor.commands.setImage(result)`
5. Schema stores: Just the URL + metadata (not base64)

### **Resizing with Aspect Ratio**

- Use Tiptap's `ResizableNodeView` (drag handles on corners)
- Lock aspect ratio by default (hold Shift to unlock)
- Persist dimensions to schema on drag end: `updateAttributes({ width, height, aspectRatio })`

---

## 🔑 **Trade-offs Summary**

| Aspect                 | Block Images    | Inline Images   |
| ---------------------- | --------------- | --------------- |
| **Complexity**         | Simple ✅       | Medium          |
| **Resize Controls**    | Easy ✅         | Hard            |
| **Selection UX**       | Clean ✅        | Tricky at edges |
| **Word Compatibility** | Good (import)   | Native          |
| **Production Use**     | Notion, Docs ✅ | Word            |

---

## ⚠️ **Common Pitfalls to Avoid**

1. **Storing base64 in schema** - Causes 33% bloat + syncing issues with Yjs
2. **Numeric attributes stored as strings** - Always `parseInt()` when parsing
3. **Inline image selection issues** - Add zero-width space (CSS `::after { content: "\200B" }`)
4. **Skipping width/height calculation** - Always get from server (not client)
5. **Not validating image URLs** - Reject `data:` URIs, validate HTTPS

---

## 🚀 **Next Steps for SafeAppeals**

1. Use **block images** with ResizableNodeView (recommended)
2. Store URLs in Supabase Storage, get signed public URLs
3. Implement server optimization with Sharp (compress, WebP conversion)
4. Add width/height/aspectRatio attributes for proper layout
5. Validate URLs on import for security
6. Support both document upload (extract images) and direct paste

All code is ready to copy-paste from `tiptap_image_implementation.ts`. The guide handles your specific legal document automation use case with proper validation, security, and performance considerations.

[1](https://discuss.prosemirror.net/t/how-to-transform-all-older-inline-nodes-to-block-nodes/5881)
[2](https://prosemirror.net/docs/guide/)
[3](https://tiptap.dev/docs/editor/core-concepts/schema)
[4](https://github.com/ueberdosis/tiptap/issues/4526)
[5](https://github.com/ProseMirror/website/blob/master/markdown/guide/doc.md)
[6](https://github.com/ueberdosis/tiptap/discussions/2090)
[7](https://discuss.prosemirror.net/t/disallow-inline-images/3611)
[8](https://tiptap.dev/docs/editor/api/resizable-nodeviews)
[9](https://prosemirror.net/docs/ref/)
[10](https://stackoverflow.com/questions/77896534/tiptap-v2-prosemirror-with-nextjs)
[11](https://github.com/ProseMirror/prosemirror/issues/132)
[12](https://ralphdeving.github.io/blog/post/tiptap-image-resize-vue)
[13](https://prosemirror.net/examples/schema/)
[14](https://geekyants.com/blog/how-to-create-a-custom-extension-in-tiptap-wysiwyg-editor)
[15](https://www.npmjs.com/package/prosemirror-image-plugin)
[16](https://aboutweb.dev/blog/tiptap2-vue3-extending-image-functionality/)
[17](https://news.ycombinator.com/item?id=29759115)
[18](https://discuss.prosemirror.net/t/prosemirror-versions-but-for-tiptap/6244)
[19](https://prosemirror.net/docs/ref/version/0.7.0.html)
[20](https://tiptap.dev/docs/editor/extensions/nodes/image)
[21](https://stackoverflow.com/questions/9722603/storing-image-in-database-directly-or-as-base64-data)
[22](https://help.figma.com/hc/en-us/articles/360046037373-Notion-and-Figma)
[23](https://www.reddit.com/r/dotnet/comments/udo2cf/is_it_a_good_idea_to_convert_images_into_base64/)
[24](https://www.reddit.com/r/FigmaDesign/comments/1nc5p05/for_the_figma_makeathon_i_built_a_nodebased_ai/)
[25](https://community.wappler.io/t/images-vs-base64-database-stored-images-and-size/3467)
[26](https://news.ycombinator.com/item?id=27200177)
[27](https://groups.google.com/g/web2py/c/uUSO1o2PXsA)
[28](https://ones.com/blog/notion-image-block-options-guide/)
[29](https://www.loro.dev/llms-full.txt)
[30](https://discuss.prosemirror.net/t/insert-image-as-base64-preferably-dragndrop/1620)
[31](https://uxdesign.cc/making-figma-and-notion-play-ball-db179a6b526f)
[32](https://huggingface.co/datasets/Tesslate/Rust_Dataset/viewer/default/train)
3a
Now I have comprehensive research. Let me generate the final professional report.

## JavaScript Garbage Collection and Base64 String Memory Management: A Technical Analysis

### Executive Summary

Large Base64-encoded image data (1-10MB) presents significant memory challenges in browser JavaScript environments, particularly when stored in rich text editor state like Tiptap's JSON. Modern JavaScript engines employ sophisticated but limited automatic deduplication mechanisms that **do not** eliminate duplicate Base64 strings when they appear in multiple locations (JSON state and DOM). Understanding these constraints is critical for implementing memory-efficient image handling in production applications.

The key insight: **identical Base64 strings stored in separate objects (JSON state vs. DOM attributes) are NOT deduplicated by default**, meaning a 5MB Base64 image duplicated in two locations consumes approximately 10MB of heap memory. This architectural limitation makes Base64 embedding inherently unsuitable for multi-image editors without complementary optimization strategies.

---

### Part 1: How Garbage Collection Handles Base64 Strings

#### The Mark-and-Sweep Algorithm

Modern JavaScript engines (V8, SpiderMonkey, JavaScriptCore) use a mark-and-sweep garbage collection algorithm rather than reference counting. This approach identifies memory for collection based on **reachability** from the global root object:[1]

1. **Mark Phase**: The GC traverses from root (global object) and marks all reachable objects
2. **Sweep Phase**: Any object not marked is deallocated
3. **Frequency**: GC runs periodically when memory pressure triggers it (not continuously)

For Base64 strings in Tiptap's JSON state, the string object remains reachable as long as:

- The editor state object exists in memory
- The JSON object containing the string is not garbage collected
- DOM elements reference the string via attributes

Once all references are removed (state cleared, DOM elements deleted, JSON dereferenced), the string becomes unreachable and eligible for collection.[2][1]

#### Base64 Strings as Immutable Primitives

In JavaScript, strings are **immutable primitives**. When you assign a Base64 string to multiple variables or properties:

```javascript
const state = { image: base64String };
img.src = "data:image/png;base64," + base64String;
```

Each assignment creates a **reference** to the underlying string data, not a copy. However, this does NOT mean automatic deduplication occurs. The critical distinction:[3]

- **String Literals in Code**: V8 automatically internalizes these (stores one copy)[4]
- **Runtime-Created Strings**: Base64 from `FileReader.readAsDataURL()` or API responses are NOT automatically pooled[3]
- **Different Creation Contexts**: When the same Base64 string is created independently in different parts of code (deserialization in JSON, construction in DOM), V8 treats them as separate string objects[3]

---

### Part 2: Do Identical Base64 Strings Get Deduplicated?

#### The Surprising Answer: Usually Not

When the same 5MB Base64 string appears in both Tiptap's JSON state and an `<img>` element's `src` attribute, **the browser typically stores two independent copies**, not one shared reference.[5][3]

**Why deduplication doesn't happen automatically:**

1. **String Interning is On-Demand**: V8 only interns strings before operations that benefit from it (primarily object property lookup via === comparison). Arbitrary string storage doesn't trigger interning.[3]

2. **Separate Creation Paths**: If the Base64 string is:

   - Loaded from JSON: `JSON.parse(data).images[0]` → creates string instance #1
   - Set in DOM: `element.src = 'data:image/png;base64,' + base64` → creates string instance #2

   These come from **different code paths** and are not deduplicated.[3]

3. **Exception—String Literals**: Only strings that appear as literals in JavaScript source code are reliably pooled:
   ````javascript
   const s1 = 'myString'  // Internalized
   const s2 = 'myString'  // Same reference as s1
   const s3 = getFromAPI() // Returns 'myString' as runtime value
   // s1 === s3 evaluates true (same value)
   // But they may use different memory addresses (separate objects)
   ```[4][6]
   ````

**Memory Implication**: A 10-image editor with 1MB Base64 images each could consume **~13-20MB** instead of the theoretical minimum, because:

- Base64 adds 33% overhead (3 bytes binary → 4 bytes Base64)[7][8]
- Each image stored in state (JSON): 1.33MB
- Each image in DOM img.src: another 1.33MB
- Potential duplication: 2 × 1.33MB × 10 images = **26.6MB** (without deduplication)

---

### Part 3: Memory Storage Overhead Details

#### Base64 Encoding Overhead

**The 33% Rule**: Base64 encodes 3 bytes of binary data as 4 characters (6 bits each).[8][7]

For a 1MB binary image:

- **Binary**: 1,048,576 bytes
- **Base64**: 1,398,101 characters (33% larger)

In V8, Base64 strings (pure ASCII) are stored as **one byte per character**, not the UTF-16 two-byte default. This is a crucial optimization: Base64 doesn't trigger the UTF-16 doubling that occurs for non-ASCII strings.[9][10]

**Total Memory for Base64 in Browser:**

```
Original binary:       1 MB
Base64 encoding:       1.33 MB (33% overhead)
V8 ASCII storage:      1.33 MB (1 byte/char since all ASCII)
Plus object wrapper:   ~24-100 bytes
─────────────────────────────
Total per image:       ~1.33 MB
```

Critically, the V8 ASCII optimization means Base64 is **relatively efficient** compared to non-ASCII Unicode strings, but still carries the inherent 33% encoding overhead.[10][9]

#### String Representation in V8's Heap

The JavaScript heap profiler distinguishes several string types:

- **Sequential String (SeqString)**: Contiguous character data with small wrapper
- **Sliced String**: Pointer into original string plus offset (created by `.substring()`)[11]
- **Cons String**: Concatenated string (created by `+` operator)
- **ExternalString**: Binary data outside heap, useful for large buffers[12][13]

When you store a large Base64 string in JSON state, V8 creates a **Sequential String** object with:

- **Shallow Size**: ~40-100 bytes (object header, length field, pointer)
- **Retained Size**: Shallow size + all character data (~1.33MB for Base64)

The heap profiler reveals the actual retained memory; simply checking variable size shows only shallow size.[14]

---

### Part 4: Reference Behavior Across Multiple Locations

#### How References Work in JavaScript

When you assign the same string to multiple variables or properties:

```javascript
const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEA..."; // 5MB
const editorState = { images: [base64] };
document.querySelector("img").src = `data:image/png;base64,${base64}`;
```

**What happens in memory:**

1. **String Creation**: `base64` variable points to string object A (5MB)
2. **State Assignment**: `editorState.images[0] = base64` → reference to object A
3. **DOM Assignment**: `img.src = ...` → **creates a new string object B** (the concatenated data URL)

The critical issue: **Step 3 creates a new string** because the DOM operation concatenates `'data:image/png;base64,'` + the Base64 value, triggering string concatenation, which creates a **Cons String** (internally), and may eventually be flattened into a new Sequential String.[10]

**Memory Impact**: The same Base64 value now exists in multiple string objects:

- Object A: Raw Base64 (5MB)
- Object B: Data URL with prefix (5MB + ~20 bytes for prefix)

These are NOT deduplicated because they're created through different operations.[3]

#### Deduplication with Explicit Pooling

JavaScript lacks a built-in equivalent to Java's `String.intern()` method. However, you can implement manual deduplication using a Map:

```javascript
const stringPool = new Map();

function internString(str) {
	if (!stringPool.has(str)) {
		stringPool.set(str, str);
	}
	return stringPool.get(str);
}

// Usage
const pooledBase64 = internString(base64);
editorState.images[0] = pooledBase64;
img.src = `data:image/png;base64,${pooledBase64}`; // Still creates new string via concatenation
```

This reduces duplication of the original Base64, but concatenation still creates a new string object.[15]

---

### Part 5: Strategies to Minimize Memory Usage for Large Images

#### 1. **Avoid Base64 for Images—Use Blob URLs Instead** (Primary Recommendation)

**Blob URLs** (`blob:` protocol URLs) are **dramatically more efficient** for in-memory image data:

```javascript
// Instead of:
const base64 = await fileReader.readAsDataURL(file); // 33% overhead, async + slow
img.src = base64; // No decoding needed, but data URL is long

// Use:
const blob = file;
const blobUrl = URL.createObjectURL(blob);
img.src = blobUrl; // Direct binary data, no encoding
// Later: URL.revokeObjectURL(blobUrl)  // Free memory
```

**Performance Comparison**:[16][17]

- **Base64 Data URL**: ~100ms to load image (requires decoding from Base64)
- **Blob URL**: ~1.5ms to load image (50x faster, direct binary access)

**Memory Comparison**:

- **Base64**: 1MB binary = 1.33MB in memory (33% overhead)
- **Blob URL**: 1MB binary = 1MB in memory (zero overhead)

**Tiptap Implementation**:

```javascript
editor.commands.setImage({ src: blobUrl });
// Store blobUrl in state instead of base64
// Important: Blob URLs are session-only; revoke when images are deleted
```

**Critical caveat**: Blob URLs are **not persistent** across page reloads. Use this only for in-session editing, not for saved state.

#### 2. **Upload Images to External Storage (Recommended for Persistence)**

For production applications, store images on a CDN or server:

```javascript
async function handleImageUpload(file) {
	const formData = new FormData();
	formData.append("file", file);

	const response = await fetch("/api/upload", {
		method: "POST",
		body: formData,
	});
	const { url } = await response.json();

	editor.commands.setImage({ src: url }); // Store URL, not data
}
```

**Advantages**:

- Zero memory overhead (only ~100 bytes for URL string)
- Images are cacheable by browser and CDN
- No garbage collection pressure
- Persistent across sessions

**Recommended Pattern**: This matches what Tiptap's official docs suggest for production image handling.[18]

#### 3. **Use IndexedDB for Offline-First Applications**

If you need persistent Base64 images without external storage:

```javascript
// Store as Blob in IndexedDB (not Base64)
const db = new Promise((resolve) => {
	const req = indexedDB.open("editor-db");
	req.onsuccess = () => resolve(req.result);
});

async function saveImage(base64String) {
	const blob = await fetch(`data:image/png;base64,${base64String}`).then((r) =>
		r.blob()
	);
	const transaction = (await db).transaction(["images"], "readwrite");
	transaction.objectStore("images").add(blob, imageId);
}
```

**Why IndexedDB is better than localStorage for Base64**:

- **localStorage**: 10MB limit, Base64 takes 33% more space → ~7.5MB effective
- **IndexedDB**: ~1GB storage, stores Blobs natively (no Base64 encoding needed)[19][20]

**Memory Impact**: IndexedDB stores binary Blobs directly, avoiding the 33% Base64 overhead entirely.[19]

#### 4. **Implement Lazy Loading and Virtual Scrolling**

For multi-image editors, don't hold all images in memory simultaneously:

```javascript
// Load image into state only when visible
const visibleImages = images.slice(pageStart, pageEnd);
const editorContent = generateTiptapJson(visibleImages);

// Monitor scroll, update visible range, garbage collect off-screen images
editor.on("focus", () => {
	// Load next batch
});
```

Modern RTEs use virtual DOM, which helps, but image data still accumulates if all images are in the editor state.[21]

#### 5. **Compress Images Before Processing**

Reduce binary size before encoding:

```javascript
async function optimizeImage(file) {
	const canvas = await canvasImageToCanvas(file);

	// Export as WebP (smaller than PNG/JPEG)
	return new Promise((resolve) => {
		canvas.toBlob(resolve, "image/webp", 0.8); // 0.8 = 80% quality
	});
}

// Usage: Pass optimized blob to editor, not original
```

A 5MB PNG compressed to WebP can drop to 1-2MB, reducing Base64 by 60-75%.[22]

#### 6. **Implement Deduplication for Identical Images**

If the same image appears multiple times:

```javascript
const imageHashToBase64 = new Map();

async function storeImageOnce(file) {
	const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
	const hashHex = [...new Uint8Array(hash)]
		.map((x) => x.toString(16).padStart(2, "0"))
		.join("");

	if (!imageHashToBase64.has(hashHex)) {
		const base64 = await fileReader.readAsDataURL(file);
		imageHashToBase64.set(hashHex, base64);
	}

	return imageHashToBase64.get(hashHex);
}
```

This ensures identical images (by content hash) are only stored once in memory.[23]

---

### Part 6: Practical Memory Optimization for Tiptap

#### Recommended Architecture:

```javascript
// Pattern 1: Production (External Storage)
editor.commands.setImage({
	src: "https://cdn.example.com/image-12345.jpg", // ~100 bytes memory
});

// Pattern 2: Local Editor Session (Blob URLs)
const blobUrl = URL.createObjectURL(imageBlob);
editor.commands.setImage({ src: blobUrl }); // ~1MB = image only
// Store in state: editorState = editor.getJSON()
// On cleanup: URL.revokeObjectURL(blobUrl)

// Pattern 3: Offline-First (IndexedDB + Blob)
const imageId = crypto.randomUUID();
await saveToIndexedDB(imageId, imageBlob);
editor.commands.setImage({ src: imageId }); // Store ID in JSON state
// When loading: retrieve blob from IndexedDB, create fresh Blob URL
```

**Memory Profile for 10-Image Document**:

| Approach             | Memory                   | Notes                                             |
| -------------------- | ------------------------ | ------------------------------------------------- |
| Base64 in JSON state | ~26.6 MB                 | 10 × 1.33MB (33% overhead), potential duplication |
| Blob URLs in memory  | ~10 MB                   | 10 × 1MB actual binary, no overhead, temporary    |
| External URLs        | ~1-2 KB                  | Just URL strings, cached by browser               |
| IndexedDB + Blob IDs | ~10 MB disk + <1 KB JSON | Images on disk, state lightweight                 |

The **external URL approach** is dramatically more memory-efficient and is the production standard.[24][25]

#### Tiptap Configuration for Images:

```javascript
import { useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";

const editor = useEditor({
	extensions: [
		StarterKit,
		Image.configure({
			// Don't allow data URLs in production
			allowBase64: false,

			// Handle image uploads on paste/drop
			HTMLAttributes: {
				class: "responsive-img",
			},
		}),
	],
});

// Intercept image insertion to upload
editor.on("update", async ({ editor }) => {
	const json = editor.getJSON();

	// Find images with data URLs
	findImages(json).forEach(async (img) => {
		if (img.attrs.src.startsWith("data:")) {
			// Upload to server
			const uploadedUrl = await uploadImage(img.attrs.src);
			// Replace data URL with server URL
			img.attrs.src = uploadedUrl;
		}
	});
});
```

---

### Part 7: Garbage Collection Timing and Memory Pressure

Garbage collection is **not immediate**. When you delete an image from Tiptap:

```javascript
editor.commands.deleteNode("image");
// GC doesn't run immediately; Base64 string still in memory
```

The Base64 string remains in memory until:

1. All references are severed (state cleared)
2. No GC cycles have made it reachable
3. GC eventually runs (timing varies by engine and memory pressure)

In browsers, GC typically runs when:

- Idle time occurs
- Memory threshold is reached
- Manually triggered (not possible in browsers, but possible in Node.js with `--expose-gc`)

For large images, **explicit cleanup is better than relying on GC**:

```javascript
// Bad: Rely on GC
editor.commands.deleteNode("image");

// Better: Explicitly clean up Blob URL
const img = getImageNode();
URL.revokeObjectURL(img.src); // Free immediately
editor.commands.deleteNode("image");

// Better: Upload and reference by URL
const uploadedUrl = await uploadToS3(imageBlob);
editor.commands.setImage({ src: uploadedUrl });
// Server stores it; browser stores only URL string
```

---

### Conclusion

JavaScript's garbage collector handles Base64 strings through mark-and-sweep reachability, but **provides no automatic deduplication** when identical strings appear in different contexts (JSON state vs. DOM). A 5MB Base64 image referenced in both locations consumes ~10MB of heap memory.

**For production rich text editors with multiple large images**, the architecture must avoid storing Base64 entirely:

1. **Primary**: Upload to external storage (CDN/server) → store URLs
2. **Secondary**: Use Blob URLs for temporary in-session work
3. **Tertiary**: IndexedDB for offline-first with native Blob storage

Base64 embedding is suitable only for very small images (<50KB) where the convenience of single-file persistence outweighs the 33% memory overhead.

Given your SafeAppeals Navigator's focus on document automation, storing images by reference (URL or database ID) will dramatically improve performance and scalability, particularly as documents grow to include multiple pages and user documents.

---

### Sources Cited

— Stack Overflow: JavaScript garbage collection[26]
— MDN: Memory management[1]
— LinkedIn: Memory management & GC[27]
— Airbnb GitHub: Base64 performance issues[28]
— Tiptap: Image preservation[18]
— Chromium Issues: String duplication[5]
— Tiptap: Persistence documentation[29]
— JavaScript.info: Garbage collection[2]
— LinkedIn: String deduplication[15]
— NodeBook: V8 string internalization[4]
— Happy Addons: Image optimization[22]
— Froala: RTE optimization[21]
— Stack Overflow: V8 string pooling[3]
— Frontend Almanac: V8 strings[6]
— Dev.to: Blob URLs[30]
— FreeCodeCamp: Base64 overhead[7]
— Lemire: Base64 space overhead[8]
— DigitalOcean: Base64 encoding[31]
— JavaScript.info: Blob[32]
— Stack Overflow: FileReader vs createObjectURL[16]
— Froala: Rich text editor with cloud storage[24]
— Hacker News: V8 ASCII optimization[9]
— Open FL Forum: URL.createObjectURL performance[17]
— Oracle APEX: RTE image storage[25]
— Google Chrome DevTools: Memory profiling[14]
— Dev.to: IndexedDB vs localStorage[19]
— V8 API: ExternalStringResourceBase[12]
— Chrome DevTools: Heap snapshots[11]
— OpenReplay: IndexedDB comparison[20]
— V8 Docs: ExternalStringResource[13]
— V8 Blog: JSON.stringify optimization[10]

[1](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management)
[2](https://javascript.info/garbage-collection)
[3](https://stackoverflow.com/questions/68789144/how-much-memory-do-v8-take-to-store-a-string)
[4](https://www.thenodebook.com/node-arch/v8-engine-intro)
[5](https://issues.chromium.org/issues/40934228)
[6](https://blog.frontend-almanac.com/v8-strings)
[7](https://www.freecodecamp.org/news/what-is-base64-encoding/)
[8](https://lemire.me/blog/2019/01/30/what-is-the-space-overhead-of-base64-encoding/)
[9](https://news.ycombinator.com/item?id=15164097)
[10](https://v8.dev/blog/json-stringify)
[11](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots)
[12](https://v8.github.io/api/head/classv8_1_1String_1_1ExternalStringResourceBase.html)
[13](https://v8docs.nodesource.com/node-11.14/d3/d29/classv8_1_1_string_1_1_external_string_resource.html)
[14](https://github.com/GoogleChrome/devtools-docs/blob/master/docs/javascript-memory-profiling.md)
[15](https://www.linkedin.com/pulse/string-deduplication-everything-you-need-know-ycrash-tb8dc)
[16](https://stackoverflow.com/questions/31742072/filereader-vs-window-url-createobjecturl)
[17](https://community.openfl.org/t/openfl-display-loader-loadbytes-performance/11827)
[18](https://tiptap.dev/docs/conversion/import-export/docx/preserve-images)
[19](https://dev.to/armstrong2035/9-differences-between-indexeddb-and-localstorage-30ai)
[20](https://blog.openreplay.com/indexeddb-localstorage-sessionstorage/)
[21](https://froala.com/blog/general/how-to-optimize-the-load-time-of-your-rich-text-editor/)
[22](https://happyaddons.com/how-to-optimize-images-for-web/)
[23](https://stackoverflow.com/questions/74329830/deduping-28-million-strings-using-javascript)
[24](https://froala.com/blog/editor/tutorials/a-react-rich-text-editor-with-advanced-image-capabilities-and-seamless-cloud-storage-solution/)
[25](https://blogs.oracle.com/apex/supporting-images-in-rich-text-editor-documents)
[26](https://stackoverflow.com/questions/8498463/how-does-the-browsers-javascript-garbage-collection-work)
[27](https://www.linkedin.com/pulse/memory-management-garbage-collector-js-alcione-f-ribeiro-kbgue)
[28](https://github.com/airbnb/javascript/issues/2297)
[29](https://tiptap.dev/docs/editor/core-concepts/persistence)
[30](https://dev.to/harsh8088/blob-urls-explained-how-they-work-and-why-they-matter-302d)
[31](https://www.digitalocean.com/community/tutorials/how-to-encode-and-decode-strings-with-base64-in-javascript)
[32](https://javascript.info/blob)
[33](https://javascript.plainenglish.io/i-was-completely-wrong-about-javascript-memory-management-until-i-learned-this-8e3cae6983b8)
[34](https://stackoverflow.com/questions/5436064/how-to-free-up-memory-after-base64-convert)
[35](https://dzone.com/articles/duplicate-strings-how-to-get-rid-of-them-and-save)
[36](https://www.youtube.com/watch?v=M3BdmN4etYg)
[37](https://www.reddit.com/r/learnjavascript/comments/1dhfj7y/javascript_garbage_collector/)
[38](https://blog.risingstack.com/node-js-at-scale-node-js-garbage-collection/)
[39](https://blog.appsignal.com/2020/10/21/garbage-collection-in-javascript.html)
[40](https://developer.mozilla.org/en-US/docs/Glossary/Garbage_collection)
[41](https://www.youtube.com/watch?v=WqNqeMjd28I)
[42](https://www.oreateai.com/blog/practical-javascript-tips-detailed-methods-for-array-and-object-deduplication/fefa9d2783c6a759faa0a6e5ef5ccf93)
[43](https://stackoverflow.com/questions/76200967/how-to-persist-data-so-that-it-does-not-get-erased-in-tiptap-editor)
[44](https://community.latenode.com/t/how-can-v8-deserialization-produce-identical-results-from-two-distinct-hexadecimal-strings/29602)
[45](https://dev.to/figsify/the-invisible-optimization-that-sped-up-the-web-how-v8-supercharged-jsonstringify-ke9)
[46](https://iliazeus.lol/articles/js-string-optimizations-en/)
[47](https://our.umbraco.com/forum/using-umbraco-and-getting-started/113105-allow-data-url-images-in-the-rich-text-editor)
[48](https://deepu.tech/memory-management-in-v8/)
[49](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/dynamicmedia/best-practices-for-optimizing-the-quality-of-your-images)
[50](https://www.reddit.com/r/javascript/comments/1cwt2px/askjs_performance_between_blob_vs_url_to_display/)
[51](https://dev.to/brampayrequest/tiptap-image-resize-extension-2328)
[52](https://kitemetric.com/blogs/blob-urls-a-deep-dive-into-client-side-data-handling)
[53](https://tiptap.dev/docs/guides/performance)
[54](https://stackoverflow.com/questions/201479/what-is-base-64-encoding-used-for)
[55](https://stackoverflow.com/questions/77782886/how-to-optimize-performance-of-my-custom-tiptap-extension)
[56](https://www.bennadel.com/blog/2966-rendering-image-previews-using-object-urls-vs-base64-data-uris-in-angularjs.htm)
[57](https://www.reddit.com/r/webdev/comments/jdwqoc/free_embedded_rich_text_editor_that_stores_images/)
[58](https://id.javascript.info/blob)
[59](https://stackoverflow.com/questions/12482415/i-need-help-a-finding-text-editor-that-can-upload-and-save-images-to-file-and-da)
[60](https://learn.microsoft.com/en-us/microsoft-edge/devtools/memory-problems/heap-snapshots)
[61](https://www.reddit.com/r/PWA/comments/f1ql1j/large_local_base64_files_slow_to_load_from/)
[62](https://javascript.plainenglish.io/heres-what-the-heap-memory-profiling-taught-me-about-memory-leaks-1c7c53388aa1)
[63](https://stackoverflow.com/questions/20756164/indexeddb-localstorage-storage-limits)
[64](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)
[65](https://codeql.github.com/codeql-query-help/javascript/js-duplicate-html-attribute/)
[66](https://www.reddit.com/r/AskProgramming/comments/102m5sp/in_javascript_why_objects_passed_as_references/)
[67](https://stackoverflow.com/questions/63252282/why-jvm-is-not-seeing-duplicate-string-value-in-string-pool-memory)
[68](https://stackoverflow.com/questions/68458799/targeting-multiple-elements-with-same-attributes-in-javascript)
[69](https://stackoverflow.com/questions/19131164/memory-allocation-in-javascript-for-duplicate-object)
[70](https://www.geeksforgeeks.org/java/string-constant-pool-in-java/)
[71](https://www.reddit.com/r/learnjavascript/comments/1cnc18f/multiple_elements_with_same_value/)
[72](https://engineering.01cloud.com/2023/04/13/object-references-and-copying/)
[73](https://www.youtube.com/watch?v=hh_aQcsHdmY)
[74](https://www.reddit.com/r/learnjavascript/comments/155qevh/does_really_memory_allocation_for_primitive_types/)
[75](https://dev.to/pokumars/exploring-javascript-pass-by-value-a-look-into-primitives-vs-objects-3842)
[76](https://github.com/ldapjs/node-ldapjs/issues/290)
[77](https://discuss.google.dev/t/js-throwing-heap-space-error-while-json-stringify-operation/12981)
[78](https://forum.xojo.com/t/detect-if-two-string-references-are-identical/38040)
[79](https://web.dev/articles/base64-encoding)
[80](https://stackoverflow.com/questions/11189940/in-node-js-using-json-stringify-results-in-process-out-of-memory-error)
[81](https://vinoo.hashnode.dev/primitives-vs-objects-in-javascript)
[82](https://www.reddit.com/r/node/comments/4vmloi/streaming_a_large_json_object_to_a_file_to_avoid/)
4a
To extract pixel dimensions without fully decoding the image, you must parse the binary file headers. This approach is orders of magnitude faster than `new Image()` because it avoids decompressing the pixel data (e.g., zlib inflation for PNG, Discrete Cosine Transform for JPEG).

Below is a pure JavaScript solution using `Uint8Array` that works in both Node.js and the browser, followed by a performance analysis.

### 1. Pure JavaScript Implementation (No Dependencies)

This function accepts a `Uint8Array` (which can be created from a Buffer or Data URL) and extracts dimensions for PNG, GIF, and JPEG.

```javascript
/**
 * Extracts width and height from image binary data without full decoding.
 * @param {Uint8Array} data - The image binary data.
 * @returns {{width: number, height: number, type: string}|null}
 */
function getImageDimensions(data) {
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

	// PNG: Signature (8 bytes) + IHDR Chunk
	// Signature: 89 50 4E 47 0D 0A 1A 0A
	if (view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
		// IHDR chunk starts at byte 8.
		// Width is at offset 16 (4 bytes), Height at offset 20 (4 bytes).
		return {
			type: "png",
			width: view.getUint32(16, false), // Big-endian
			height: view.getUint32(20, false),
		};
	}

	// GIF: Signature (3 bytes "GIF") + Version (3 bytes "89a")
	// Signature: 47 49 46
	if (view.getUint32(0, false) >>> 8 === 0x474946) {
		// Logical Screen Descriptor starts at index 6.
		// Width at offset 6 (2 bytes), Height at offset 8 (2 bytes).
		return {
			type: "gif",
			width: view.getUint16(6, true), // Little-endian
			height: view.getUint16(8, true),
		};
	}

	// JPEG: Start of Image (FF D8)
	if (view.getUint16(0, false) === 0xffd8) {
		let offset = 2; // Start after SOI
		while (offset < view.byteLength) {
			// Check for valid marker 0xFF
			if (view.getUint8(offset) !== 0xff) {
				offset++; // Handle padding bytes
				continue;
			}

			const marker = view.getUint8(offset + 1);

			// SOF0 (Baseline) to SOF15, excluding DHT, DAC, etc.
			// C0-CF are Start of Frame markers, except C4 (DHT), C8 (JPG), CC (DAC)
			if (
				marker >= 0xc0 &&
				marker <= 0xcf &&
				marker !== 0xc4 &&
				marker !== 0xc8 &&
				marker !== 0xcc
			) {
				// Found SOF marker. Payload structure:
				// [Length (2B)] [Precision (1B)] [Height (2B)] [Width (2B)]
				const height = view.getUint16(offset + 5, false);
				const width = view.getUint16(offset + 7, false);
				return { type: "jpg", width, height };
			}

			offset += 2; // Move past 0xFF and Marker

			// Read segment length (includes the 2 bytes for length itself)
			const length = view.getUint16(offset, false);
			offset += length; // Skip segment
		}
	}

	return null; // Unknown format or parse error
}

// Helper: Convert Base64 Data URL to Uint8Array
function parseDataUrl(dataUrl) {
	const base64 = dataUrl.split(",")[1];
	const binaryString = atob(base64);
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

// Example Usage
// const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg==";
// const bytes = parseDataUrl(dataUrl);
// console.log(getImageDimensions(bytes)); // { type: 'png', width: 1, height: 1 }
```

### 2. Header Layout & Analysis

| Format   | Marker / Signature   | Location of Dimensions                                                                  | Endianness        |
| :------- | :------------------- | :-------------------------------------------------------------------------------------- | :---------------- |
| **PNG**  | `0x89504E47...`      | **IHDR Chunk** (bytes 16–24). Fixed position.                                           | Big-Endian        |
| **GIF**  | `GIF87a` or `GIF89a` | **Logical Screen Descriptor** (bytes 6–10). Fixed position.                             | **Little-Endian** |
| **JPEG** | `0xFFD8` (SOI)       | **SOFn Segment** (`0xC0`, `0xC2`, etc.). Variable position; requires scanning segments. | Big-Endian        |

**Implementation Note:**
JPEG is the only complex format here. You must scan through segments (like EXIF data `0xE1` or Comments `0xFE`) by reading their length field and skipping them until you find a Start of Frame (`SOF`) marker.

### 3. Performance: `new Image()` vs. Header Parsing

Using `new Image()` forces the browser to engage the full rendering pipeline. Header parsing is strictly O(1) for PNG/GIF and O(N) for JPEG (where N is header size, typically <50KB), avoiding the O(Pixels) cost of decompression.

| Feature      | `new Image()` + `onload`                             | Binary Header Parsing                             |
| :----------- | :--------------------------------------------------- | :------------------------------------------------ |
| **Decoding** | **Full Decode**: Decompresses pixel data (zlib/DCT). | **None**: Reads <100 bytes usually.               |
| **Memory**   | High (Allocates bitmap for raw pixels).              | Low (Only needs header bytes).                    |
| **Latency**  | **~10–100ms** (Depends on image size). Async only.   | **< 0.05ms** (Microseconds). Synchronous.         |
| **I/O**      | Requires downloading the full file to decode safely. | Can use `Range` headers to fetch only first 64KB. |

**Performance Impact:**
If you are processing a batch of 1,000 images:

- **`new Image()`**: Will likely freeze the main thread or exhaust memory as it attempts to decode 1,000 bitmaps into RAM.
- **Header Parsing**: Will complete in milliseconds with negligible memory footprint.

### 4. Library Implementation Comparison

Since you prefer the "latest packages," you should know how the ecosystem handles this.

#### Sharp (Recommended for Node.js)

**Sharp** uses `libvips` (C++), which is extremely optimized. It does exactly what the binary parser above does but at the native level.

- **Method:** `sharp(input).metadata()`
- **Behavior:** It extracts dimensions from the header **without** decoding the compressed pixel data.
- **Performance:** Near-native speed. Faster than any pure JS implementation for complex JPEGs but slightly heavier overhead than the raw function above for single small operations.

```javascript
import sharp from "sharp";

// ⚡ Fast: Reads header only
const metadata = await sharp("image.jpg").metadata();
console.log(metadata.width, metadata.height);
```

#### Jimp

**Jimp** is a pure JavaScript image processing library.

- **Behavior:** Historically, `Jimp.read()` parses and decodes the **entire** image into a bitmap immediately.
- **Performance:** Significantly slower for just checking dimensions. In benchmarks, Jimp can be 20x–50x slower than Sharp because it decodes pixels using JS.
- **Verdict:** Avoid Jimp if you only need metadata.

#### Probe-Image-Size (Best Lightweight Alternative)

If you don't want the heavy C++ compilation of Sharp but want a robust library, use **`probe-image-size`**. It implements the exact logic provided in section 1 but handles edge cases (like invalid JPEGs or orientation) and supports Streams (fetching only the first few packets from a URL).

```javascript
import probe from "probe-image-size";

// Fetches minimum bytes required to find header
const result = await probe("https://example.com/huge-image.jpg");
console.log(result.width, result.height);
```

[1](https://stackoverflow.com/questions/17774928/get-image-width-and-height-from-the-base64-code-in-javascript)
[2](https://www.reddit.com/r/learnjavascript/comments/qi0xzg/how_to_get_the_width_and_height_dimensions_of_an/)
[3](http://blog.calyptus.eu/seb/2009/05/png-parser-in-javascript/)
[4](https://developer.mozilla.org/en-US/blog/image-formats-pixels-graphics/)
[5](https://nbevans.wordpress.com/2015/04/17/super-fast-way-to-extract-widthheight-dimensions-of-png-and-jpeg-images/)
[6](https://viereck.ch/png-header/)
[7](https://www.php.net/manual/en/function.getimagesize.php)
[8](https://formats.kaitai.io/gif/javascript.html)
[9](https://web.dev/learn/performance/image-performance)
[10](https://www.digitalocean.com/community/tutorials/how-to-process-images-in-node-js-with-sharp)
[11](https://qpco.ca/2024/03/21/jimp-dev-jimp-an-image-processing-library-written/?amp)
[12](https://vivaxyblog.github.io/2019/11/07/decode-a-png-image-with-javascript.html)
[13](https://carmalou.com/image-manipulation-series/2025/08/05/parsing-pngs-pt-1.html)
[14](https://www.spidersoft.com.au/2017/checking-jpeg-image-dimension-from-partial-headers/)
[15](https://stackoverflow.com/questions/6821952/how-do-browsers-detect-gif-image-sizes)
[16](https://github.com/PostgREST/postgrest/issues/1077)
[17](https://blog.logrocket.com/processing-images-sharp-node-js/)
[18](https://www.peterbe.com/plog/sharp-vs-jimp)
[19](https://pqina.nl/blog/convert-an-image-to-a-base64-string-with-javascript/)
[20](https://stackoverflow.com/questions/16724849/how-do-i-extract-the-width-and-height-of-a-png-from-looking-at-the-header-in-obj)
[21](https://stackoverflow.com/questions/15800704/get-image-size-without-loading-image-into-memory)
[22](https://stackoverflow.com/questions/62653165/can-we-get-height-and-width-of-image-using-sharp)
[23](https://www.npmjs.com/package/probe-image-size?activeTab=versions)
[24](https://gitea1.its.isti.cnr.it/manolas/vcglib/commit/1a1844cb34b7f8e62b2b736157af98ffdcbf15de)
[25](https://github.com/oliver-moran/jimp/issues/255)
[26](https://sharp.pixelplumbing.com/api-input/)
[27](https://stackoverflow.com/questions/623172/how-to-get-the-image-size-height-width-using-javascript)
[28](https://stackoverflow.com/questions/26715684/parsing-jpeg-sos-marker)
[29](https://www.vbforums.com/showthread.php?625535-RESOLVED-How-do-i-get-Dimensions-of-image-without-loading-it)
[30](https://anthonysimmon.com/benchmarking-dotnet-libraries-for-image-resizing/)
[31](https://socket.dev/npm/package/probe-image-size)
[32](https://community.adobe.com/t5/photoshop/how-to-use-js-to-read-image-format-information/m-p/10700216)
[33](https://www.youtube.com/watch?v=EPlXPdNvQEY)
5a
Perfect. Now I'll create my comprehensive final report with all findings integrated.

## Complete Workflow for Image Preservation in Web-Based DOCX Editors

The challenge of preserving images through a DOCX round-trip (load → edit → save) involves careful orchestration across three distinct phases: extraction, editing, and re-embedding. This requires understanding both the OOXML structure and the architectural tradeoffs of web-based editing.

### OOXML Image Storage Architecture

DOCX files are ZIP containers with a specific structure for image management. Images reside in the `/word/media/` directory as binary files (e.g., `image1.png`, `image2.jpeg`), but are controlled by XML relationships defined in two critical files:[1][2][3]

**Document.xml** contains references to images using relationship IDs. In modern DOCX files created after Word 2007, these appear as DrawingML elements:

```xml
<a:blip r:embed="rId4" cstate="print"/>
```

In legacy formats or documents created via copy-paste, they may use VML (Vector Markup Language):

```xml
<v:imagedata r:id="rId1"/>
```

**document.xml.rels** maintains the actual mapping between relationship IDs and media file locations:

```xml
<Relationship Id="rId4"
  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
  Target="media/image1.png"/>
```

Additionally, **[Content_Types].xml** at the package root defines MIME types for all media files, declaring that `.png`, `.jpeg`, and other image formats are part of the package.[4][5]

This tri-file dependency means image preservation requires maintaining perfect synchronization across all three components—a single broken link results in the infamous "image part with relationship rID8 was not found" error.[6][7]

### Phase 1: Image Extraction During Load

When a DOCX is uploaded to a web editor, the extraction phase must recover both binary image data and relationship metadata:[8][9]

1. **Unzip and Parse**: Convert the DOCX (ZIP file) to bytes, extract the `/word/media/` folder contents, and parse `document.xml.rels`
2. **Build Image Registry**: Create an in-memory map linking each `rId` → media filename → binary blob
3. **Preserve Format Information**: Determine original image format (PNG compression metadata, JPEG quality settings, DPI) to avoid re-compression during re-embedding[10][8]
4. **Extract Relationship Context**: Record not just the image file, but the complete relationship definition including Type and Target attributes

A critical oversight at this stage is losing the distinction between images inserted via "Insert Picture" (DrawingML, higher fidelity) versus copy-paste (VML, legacy, potentially lower quality). Python-docx and docx4j both advertise "round-trip preservation of all parts and relationships" precisely because this metadata matters.[11][12][13][8]

### Phase 2: Temporary Storage During Editing

The choice of temporary storage directly impacts both performance and data safety. Commercial solutions employ different strategies:

**Server-Side Session Storage** (Traditional web editors)

- Approach: Generate unique filenames with session IDs, store in `/tmp/uploads/{sessionId}/`
- Cleanup: Triggered by `Session_End` event or explicit session timeout detection[14]
- Tradeoff: Scalability burden on web farm; requires sticky sessions or distributed cache for horizontal scaling
- Security: Server-controlled; appropriate for enterprise deployments

**Browser-Side Storage** (Client-Heavy Editors)

- IndexedDB: Persistent across sessions; supports Blob storage up to hundreds of MB[15][16]
- SessionStorage: Automatic cleanup on tab close; limited to 5-10MB per domain
- Advantage: Offline capability; no server-side cleanup required
- Limitation: Subject to browser quota policies; restricted by cross-origin policy

**Base64 Embedding in Session State**

- Encode images as data URIs: `data:image/png;base64,iVBORw0KGgo...`
- Tradeoff: 33% size overhead due to base64 encoding, but simplifies transmission in JSON[17]
- Used by Apryse and some template-based editors[17]

**Cloud Storage with Temporary Access**

- Syncfusion and Azure-integrated editors upload images to cloud with SAS (Shared Access Signature) tokens
- Advantage: Eliminates server storage burden; images remain available if browser crashes[18][19]
- Implementation: Token expiry ensures automatic cleanup; compatible with multi-tenant SaaS

Collabora Online's approach differs fundamentally: LibreOffice runs server-side and streams only rendered image tiles to the browser, avoiding binary image transmission entirely. OnlyOffice takes a similar path, maintaining images in native format on the server.[20][21]

### Phase 3: The Impendance Mismatch Problem

Converting OOXML to browser-editable format (HTML or JSON) introduces what docx4j developers call "the impendance mismatch"—many OOXML features don't have HTML equivalents, and naive HTML-to-OOXML conversion loses formatting.[22][23]

For images specifically, the risks include:

1. **Format Conversion Artifacts**: Converting to HTML/JPEG for display may apply compression not in the original
2. **Metadata Loss**: Image sizing, positioning (anchored vs. inline), text wrapping, and effects aren't preserved in simple HTML
3. **Relationship Context Loss**: The rId mapping may be forgotten if the editor focuses only on visual content

Sophisticated editors address this through **session-state preservation of problematic content**. The docx-html-editor proof-of-concept identifies OOXML elements that CKEditor would "mangle" and preserves them separately, replacing them with visual placeholders during editing and restoring original markup on save. This avoids attempting HTML round-trip for complex image layouts.[22]

### Phase 4: Re-Embedding and Relationship Reconstruction

Reconstructing a DOCX from edited content requires careful sequencing:

1. **Collect Updated Images**: Gather modified/added images from browser storage
2. **Assign New rIds**: Generate sequential relationship IDs for any new images (rId1, rId2, etc.), ensuring no collisions with existing relationships[24][25]
3. **Update Media Folder**: Add all image binaries back to `/word/media/` within the ZIP
4. **Rewrite document.xml.rels**: Update all `<Relationship>` entries with correct rId → media filename mappings[6][24]
5. **Update [Content_Types].xml**: Ensure the package includes `<Default Extension="png" ContentType="image/png"/>` entries for all media types present
6. **Preserve Untouched Relationships**: For images not edited, preserve original rIds and relationship definitions to minimize divergence

The order matters: if you add images to the ZIP before updating document.xml.rels, the relationships won't resolve. If you forget [Content_Types].xml entries, some applications will report missing content types.[25][24]

### Common Failure Modes and Prevention

**1. Broken Relationships (Most Common)**

- Symptom: "The image part with relationship rID8 was not found"[6][7]
- Causes:
  - Media file deleted but relationship definition remains
  - Relationship Target set to "NULL" instead of "media/image1.png"[6]
  - Zipping process fails to include /media folder
- Prevention:
  - Validate every entry in document.xml.rels before saving
  - Confirm Target attribute is not null; use regex matching "media/[image_name]"
  - Unit test: For each rId in document.xml, verify corresponding media file exists in ZIP

**2. Orphaned Relationships**

- Symptom: File opens but images missing; placeholder icons show
- Cause: Relationships exist in document.xml.rels but media files deleted
- Prevention:
  - Implement bidirectional validation: check media folder against relationships AND relationships against media folder
  - Delete unused relationships during cleanup phase
  - Maintain a "used relationships" set while parsing document.xml to identify orphans

**3. Image Compression Loss**

- Symptom: Images appear pixelated or degraded after round-trip
- Root Causes:
  - Re-compression during JPEG save-as-new
  - Word's automatic compression if "Do not compress images in file" not set[8][10]
  - Conversion from PNG to JPEG losing transparency
- Prevention:
  - Preserve original image bytes; avoid re-encoding unless necessary
  - Copy binary data directly: `imagePart._blob = originalImageBytes`[26]
  - For Word-inserted images: set File > Options > Advanced > Image Size and Quality > "High fidelity"[10]
  - Store image metadata (DPI, original format) in session state

**4. Format Mismatch (VML vs. DrawingML)**

- Symptom: Images render in Office but not in competing products; formatting lost
- Context: Word 2003 and legacy documents use VML; Word 2007+ prefer DrawingML[13][27]
- Prevention:
  - Detect insertion method during extraction; preserve original format
  - Do not convert VML to DrawingML (or vice versa) unless absolutely necessary
  - Modern editors should default to DrawingML for new images[27]

**5. Session Expiration Loss**

- Symptom: User returns after 24 hours; temporary files deleted; edits lost
- Prevention (varies by storage strategy):
  - **Server files**: Implement session persistence; save work-in-progress to database, not just temp folder
  - **Browser IndexedDB**: Use versioning; prompt user if cached data is stale
  - **Cloud storage**: Implement explicit "Save" button triggering final DOCX generation; don't rely on auto-expiry

**6. Character Encoding and Special Characters in Filenames**

- Symptom: Media folder files have scrambled names; relationships can't resolve
- Prevention:
  - Use UTF-8 encoding consistently
  - Sanitize filenames; avoid special characters in image references
  - Use format: `media/image{incrementing_number}.{original_extension}`

### Commercial Solution Comparison

| Solution                           | Storage Model                              | Image Preservation                                 | Round-Trip Success                         |
| ---------------------------------- | ------------------------------------------ | -------------------------------------------------- | ------------------------------------------ |
| **Collabora Online**[20][21]       | Server-side (LibreOffice rendering)        | Native; no browser transmission                    | High; full OOXML fidelity                  |
| **OnlyOffice**[28]                 | Server-side (similar to Collabora)         | Native DOCX/XLSX support                           | High; optimized for Microsoft formats      |
| **Google Docs**                    | Server-side + Cloud Storage                | Conversion to Google format; lossy on DOCX export  | Medium; some formatting loss on round-trip |
| **Apryse WebViewer**[29][17]       | Client-side (native DOCX)                  | Base64 or blob storage; direct binary preservation | Highest; reverse-engineers DOCX format     |
| **Syncfusion Document Editor**[18] | Cloud (Azure Blob) with JSON serialization | Blob references; temporary tokens                  | High; cloud-backed reliability             |

Collaborative editors (Collabora, OnlyOffice) achieve the highest image fidelity because LibreOffice/LibreODF runs server-side and natively handles OOXML, avoiding format conversion entirely. Web-native editors (Apryse) achieve this by reverse-engineering the DOCX format and manipulating it directly in the browser.

### Recommended Implementation Pattern

For a production DOCX editor, the safest workflow combines:

1. **Extract & Validate**: Unzip DOCX, parse all relationships, compute SHA-256 hash of each image binary
2. **Session Storage**: Store images in IndexedDB with versioning; maintain metadata map (rId → blob → hash)
3. **Editing in Session State**: Preserve original OOXML for untouched regions; track only modifications
4. **Lazy Revalidation**: Before save, verify all rIds resolve to media files; recompute hashes
5. **Atomic Reassembly**: Generate new DOCX only after all validations pass; commit to ZIP in single operation
6. **Post-Save Verification**: Open regenerated DOCX, parse relationships, confirm image count matches original

This pattern prevents partial saves (corrupted documents mid-upload), ensures images aren't lost to timing issues, and provides rollback capability if validation fails.

---

[1](https://support.microsoft.com/en-au/topic/wd-how-to-extract-embedded-images-from-a-word-document-f478bf7f-3bba-6afb-6ddc-3eeb284af36b)
[2](https://deparkes.co.uk/2016/12/23/how-word-files-store-images/)
[3](https://github.com/jgm/pandoc/issues/10759)
[4](https://www.deusinmachina.net/p/how-word-processor-file-formats-work)
[5](https://en.wikipedia.org/wiki/Office_Open_XML_file_formats)
[6](https://learn.microsoft.com/en-us/troubleshoot/microsoft-365-apps/word/image-part-relationship-rld8-not-found-error-microsoft-word)
[7](https://github.com/python-openxml/python-docx/issues/1105)
[8](https://www.antennahouse.com/osdc-how-can-are-images-embedded)
[9](https://zenodo.org/records/17073463)
[10](https://support.microsoft.com/en-us/office/change-the-default-resolution-for-inserting-pictures-in-office-f4aca5b4-6332-48c6-9488-bf5e0094a7d2)
[11](https://pypi.org/project/python-docx/0.8.10/)
[12](https://pypi.org/project/python-docx/0.8.2/)
[13](http://officeopenxml.com/drwOverview.php)
[14](https://stackoverflow.com/questions/1065618/how-to-temporarily-store-images-on-web-server-per-session-in-asp-net-and-c-sha)
[15](https://blog.pixelfreestudio.com/how-to-implement-client-side-caching-for-faster-load-times/)
[16](https://stackoverflow.com/questions/14113278/storing-image-data-for-offline-web-application-client-side-storage-database)
[17](https://apryse.com/blog/base64-images-dynamic-document-generation)
[18](https://help.syncfusion.com/document-processing/word/word-processor/javascript-es6/opening-documents/azure-blob-storage)
[19](https://www.textcontrol.com/blog/2024/04/08/loading-documents-from-azure-blob-storage-into-tx-text-control-document-editor-using-pure-javascript/)
[20](https://www.collaboraonline.com/comparing-collabora-with-onlyoffice/)
[21](https://blog.jospoortvliet.com/2020/06/collabora-vs-onlyoffice.html)
[22](https://github.com/plutext/docx-html-editor)
[23](https://www.docx4java.org/blog/2014/10/web-based-docx-editing/)
[24](https://stackoverflow.com/questions/2810138/replace-image-in-word-doc-using-openxml)
[25](https://stackoverflow.com/questions/47895856/docx-file-corruption-with-image)
[26](https://stackoverflow.com/questions/51687223/copying-docx-and-preserving-images)
[27](https://docs.telerik.com/reporting/knowledge-base/images-missing-from-docx-in-onedrive)
[28](https://www.onlyoffice.com/blog/2018/08/onlyoffice-or-collabora-who-proves-better-in-collaboration)
[29](https://apryse.com/blog/webviewer/create-edit-word-docx-document-in-web-app)
[30](https://support.inera.com/support/solutions/articles/1000217826-workflow-options-for-handling-graphics-in-your-word-document)
[31](https://products.aspose.app/words/extract/images-from-docx)
[32](https://learn.microsoft.com/en-us/answers/questions/4842877/how-to-preserve-original-image-quality-for-a-inser)
[33](https://dev.to/allen_yang_f905170c5a197b/automating-image-extraction-from-docx-files-with-python-533f)
[34](https://www.coursehero.com/file/114824834/notes-3docx/)
[35](https://products.groupdocs.cloud/parser/net/images/docx/)
[36](https://www.reddit.com/r/MicrosoftWord/comments/m63xgg/embed_web_images_without_having_them_in_the_docx/)
[37](https://cdn-images.prepp.in/public/image/ExtractedRRB_JE_2018_CBT_2_Information_Technology_Question_Paper_and_Answer_Key_PDF_Aug_30_2019__b65ad87e040e9d8cb075871b304142de.pdf)
[38](https://supertool.org/extract-images-from-word-files/)
[39](https://www.syncfusion.com/free-tools/online-docx-editor/)
[40](https://community.adobe.com/t5/acrobat/how-to-preserve-embedded-object-when-converting-from-word-2016/m-p/9651586)
[41](https://www.systoolsgroup.com/how-to/convert-image-to-editable-docx-format/)
[42](https://help.collaboraoffice.com/6.2/en-US/text/shared/guide/protection.html)
[43](https://www.youtube.com/watch?v=sVINSXKPM4E)
[44](https://www.youtube.com/watch?v=eC6VmwWEcXw)
[45](https://workspace.google.com/marketplace/app/img_to_docs_image_ocr/1024533292248)
[46](https://help.nextcloud.com/t/onlyoffice-or-collabora/12262)
[47](https://updf.com/ocr/convert-image-to-text-google-docs/)
[48](https://help.syncfusion.com/document-processing/word/word-processor/asp-net-mvc/opening-documents/azure-blob-storage)
[49](https://learn.microsoft.com/en-us/answers/questions/5071447/microsoft-word-doc-embedded-picture-files-corrupte)
[50](https://community.activepieces.com/t/how-do-i-convert-base64-image-to-a-temporary-file/3813)
[51](https://stackoverflow.com/questions/17658013/image-disappears-in-my-docx-document-after-altering-and-saving-it)
[52](https://forum.aspose.com/t/embed-images-as-base64-strings-during-word-docx-to-html-conversion-and-save-html-file-back-to-docx-roundtrip-c-net/178305)
[53](https://www.mend.io/blog/vector-and-embedding-weaknesses-in-ai-systems/)
[54](https://learn.microsoft.com/en-us/office/dev/add-ins/word/create-better-add-ins-for-word-with-office-open-xml)
[55](https://www.opensourceforu.com/2025/06/when-embeddings-miss-the-point-the-quiet-crisis-in-embedding-models/)
[56](https://stackoverflow.com/questions/9722603/storing-image-in-database-directly-or-as-base64-data)
[57](https://www.reddit.com/r/codes/comments/c8x9he/received_a_docx_file_that_may_hide_some/)
[58](https://www.reddit.com/r/flask/comments/oct9fu/best_way_to_temporarily_store_session_images/)
[59](https://community.spiceworks.com/t/word-docs-with-corrupted-images/305985)
[60](https://dev.to/aneeqakhan/a-developers-guide-to-browser-storage-local-storage-session-storage-and-cookies-4c5f)
[61](https://github.com/nextcloud/all-in-one/discussions/5656)
[62](https://www.w3schools.com/html/html5_webstorage.asp)
[63](https://learn.microsoft.com/en-us/answers/questions/4863191/save-of-word-doc-corrupts-embedded-image-files?forum=msoffice-all)
[64](https://www.msofficeforums.com/word/13990-saving-doc-web-page-filtered-reduces-some.html)
[65](https://stackoverflow.com/questions/18379806/extracting-images-and-hyperlinks-from-docx-file-from-docx4j-api)
[66](https://github.com/guillepg/docx4j/blob/master/src/main/java/org/docx4j/openpackaging/parts/WordprocessingML/BinaryPartAbstractImage.java)
[67](https://www.adobe.com/acrobat/hub/how-to-preserve-image-quality-word-to-pdf.html)
[68](https://iprofs.wordpress.com/2012/10/22/adding-images-and-layout-to-your-docx4j-generated-word-documents-part-1/)
[69](https://pypi.org/project/tp-python-docx/)
[70](https://www.youtube.com/watch?v=5ra54nGuE5o)
[71](http://www.docx4java.org/forums/docx-java-f6/embed-images-from-an-html-output-to-doc-t818.html)
[72](https://www.harrytheo.com/blog/2021/07/placeholder-images-for-pwas/)
[73](https://www.toptal.com/developers/xml/an-informal-introduction-to-docx)
[74](http://www.docx4java.org/forums/docx-java-f6/vml-elements-t199.html)
[75](https://themeisle.com/blog/missing-images-on-website/)
[76](https://stackoverflow.com/questions/68873204/adding-a-fallback-image-htmlcss)
[77](https://www.linkedin.com/pulse/understanding-docx-sagar-devanga-mm3qf)
[78](https://learn.microsoft.com/en-us/answers/questions/2136339/when-is-the-o-gfxdata-element-in-the-docx-format-a)
[79](https://www.joomunited.com/news/how-to-set-a-default-fallback-image-for-wordpress-post-thumbnails)
[80](https://github.com/knadh/indexed-cache)
[81](https://learn.microsoft.com/en-us/answers/questions/5444037/i-am-trying-to-recover-what-i-can-from-an-old-vers)
[82](https://repairit.wondershare.com/file-repair/docx-repair-tool-repair-recover-word-docx-files.html)
[83](<https://learn.microsoft.com/en-us/answers/questions/5274933/(document-xml-rels)-the-image-part-with-relationsh>)
[84](https://learn.microsoft.com/en-us/troubleshoot/microsoft-365-apps/word/damaged-documents-in-word)
[85](https://forums.tomsguide.com/threads/corrupted-word-document-xml-correction.83213/)
[86](https://roelofjanelsinga.com/articles/indexeddb-caching-your-data-on-the-client-side/)
[87](https://www.reddit.com/r/MicrosoftWord/comments/1e0brqe/word_document_has_found_unreadable_content_but/)
[88](https://www.reddit.com/r/MicrosoftWord/comments/ukw4v9/is_there_a_way_to_analyze_problematic_documents/)
