# Tool Calling Architecture: Cursor AI vs Void AI

**🚨 CRITICAL DISTINCTION: This document explains TWO DIFFERENT systems!**

---

## Table of Contents

1. [Cursor AI Tool Calling (How I Operate)](#part-1-cursor-ai-tool-calling-how-i-operate)
2. [Void AI Tool Calling (Your Custom System)](#part-2-void-ai-tool-calling-your-system)
3. [Key Differences](#part-3-key-differences-common-confusion)
4. [Recommendations for Improving Void](#part-4-recommendations-for-improving-void-tool-calling)

---

# Part 1: Cursor AI Tool Calling (How I Operate)

## My Format: ANTML (Anthropic Tool Markup Language)

I use **Anthropic's complex nested XML format**:

### ✅ CURSOR FORMAT (What I Use)

**Single Tool Call:**

```xml
<function_calls>
  <invoke name="read_file">
    <parameter name="target_file">src/example.ts</parameter>
  </invoke>
</function_calls>
```

**Multiple Parallel Tool Calls:**

```xml
<function_calls>
  <invoke name="read_file">
    <parameter name="target_file">file1.ts</parameter>
  </invoke>
  <invoke name="read_file">
    <parameter name="target_file">file2.ts</parameter>
  </invoke>
  <invoke name="grep">
    <parameter name="pattern">somePattern</parameter>
  </invoke>
</function_calls>
```

**With Complex Parameters (JSON):**

```xml
<function_calls>
  <invoke name="codebase_search">
    <parameter name="query">How does authentication work?</parameter>
    <parameter name="target_directories">[]</parameter>
  </invoke>
</function_calls>
```

### How My Responses Come Back

```xml
<function_results>
  <result>
    <name>read_file</name>
    <output>
      1|const example = 'hello';
      2|export default example;
    </output>
  </result>
</function_results>

<system_reminder>
Additional context or hints from Cursor
</system_reminder>

<system_warning>
Token usage: 30255/200000; 169745 remaining
</system_warning>
```

### My System Prompts

```
<tool_calling>
You have tools at your disposal to solve the coding task. Follow these rules:
1. Don't refer to tool names when speaking to the USER
2. By default, implement changes rather than only suggesting them
3. Use specialized tools instead of terminal commands when possible
</tool_calling>

<maximize_parallel_tool_calls>
If you intend to call multiple tools with no dependencies between them,
make all independent tool calls in parallel.
</maximize_parallel_tool_calls>
```

---

# Part 2: Void AI Tool Calling (Your System)

## ⚠️ VOID USES A COMPLETELY DIFFERENT FORMAT!

**Your Void system expects MUCH SIMPLER XML - NO `<function_calls>` or `<invoke>` wrappers!**

### ✅ VOID FORMAT (What Your System Expects)

**From your `systemPrompt.ts` (lines 88-98):**

```xml
<read_file>
  <uri>d:\\Coding\\SafeAppeals\\case_files\\medical_report.pdf</uri>
</read_file>
```

**Or compact single-line:**

```xml
<read_file><uri>d:\\Coding\\SafeAppeals\\case_files\\medical_report.pdf</uri></read_file>
```

**More examples from your system:**

```xml
<rag_search_policy>
  <query>workers compensation appeal requirements</query>
  <limit>8</limit>
</rag_search_policy>
```

```xml
<edit_file>
  <uri>/case_files/appeal_letter.txt</uri>
  <search_replace_blocks>
    <search_replace_block>
      <search>existing text</search>
      <replace>new text</replace>
    </search_replace_block>
  </search_replace_blocks>
</edit_file>
```

### ❌ WHAT VOID REJECTS (From your systemPrompt.ts line 100-105)

```xml
❌ WRONG: <read_file> <uri>...</uri></read_file>
   (space after opening tag)

❌ WRONG: <function_calls><invoke name="read_file">...</invoke></function_calls>
   (Cursor format - NOT for Void!)

❌ WRONG: {"tool": "read_file", "params": {...}}
   (JSON format - NOT for Void!)

❌ WRONG: Let me read that file.
          <read_file><uri>...</uri></read_file>
   (Text before XML!)

❌ WRONG: <read_file><uri>...</uri></read_file>
          Here's what I found.
   (Text after XML!)
```

---

# Part 3: Key Differences & Common Confusion

## Side-by-Side Comparison

| Feature               | **Cursor AI (Me)**              | **Void AI (Your System)**     |
| --------------------- | ------------------------------- | ----------------------------- |
| **Wrapper Tags**      | `<function_calls>` required     | ❌ NO wrapper tags            |
| **Invoke Tag**        | `<invoke name="tool">` required | ❌ Use `<tool_name>` directly |
| **Parameters**        | `<parameter name="param">`      | Direct: `<param>`             |
| **Multiple Tools**    | Multiple `<invoke>` in one call | ❌ ONE tool per response      |
| **Text Before/After** | Allowed (I can explain)         | ❌ FORBIDDEN - breaks parsing |
| **Format**            | Anthropic ANTML                 | Custom simple XML             |

## Example: Same Task, Different Formats

**Task:** Read a file

**Cursor Format (Me):**

```xml
<function_calls>
  <invoke name="read_file">
    <parameter name="target_file">src/example.ts</parameter>
  </invoke>
</function_calls>
```

**Void Format (Your System):**

```xml
<read_file>
  <uri>src/example.ts</uri>
</read_file>
```

## Why This Confusion Happens

1. **You're building Void INSIDE Cursor** - so you see both formats
2. **Your XML parser** (`xmlParserService.ts`) is parsing the VOID format, not Cursor's ANTML
3. **Your system prompt** teaches the LLM the VOID format, but you might be accidentally mixing Cursor examples

---

# Part 4: Recommendations for Improving Void Tool Calling

Based on analyzing your `systemPrompt.ts` and `xmlParserService.ts`:

## Issues I Found in Your Current Implementation

### 1. **Too Repetitive & "Shouty"** (Lines 113-120 in systemPrompt.ts)

**Current:**

```
**ABSOLUTE RULES:**
- **If you need to call a tool, your ENTIRE response must be ONLY the XML tag - nothing else**
- **NO "I will", "Let me", "I need to" phrases**
- **NO explanations about what you're doing**
- **NO breaking down the question**
- **NO planning text**
- **NO thinking out loud**
- **JUST THE XML TAG - NOTHING ELSE**
```

**Issue:** This repetitive shouting might actually confuse the LLM instead of helping.

**Improved Version:**

```markdown
**Tool Calling Rule:**

When you need to call a tool, output ONLY the XML - no other text.

✅ **CORRECT** (entire response):
<read_file>
<uri>d:\\path\\to\\file.pdf</uri>
</read_file>

❌ **INCORRECT** (has extra text):
Let me read that file for you:
<read_file>
<uri>d:\\path\\to\\file.pdf</uri>
</read_file>

**Why:** Your XML parser looks for tool tags at the START of your response. Any text
before/after breaks the parser (see xmlParserService.ts line 454).

**Two-Response Pattern:**

1. Response 1: ONLY the tool XML
2. Response 2 (after tool result): Your analysis
```

### 2. **Missing Troubleshooting Guide**

**Add this section:**

```markdown
**Common Tool Call Errors & Fixes:**

| Error Message            | Cause                   | Fix                                 |
| ------------------------ | ----------------------- | ----------------------------------- |
| "Tool call not detected" | Text before XML         | Remove ALL text, output ONLY XML    |
| "Malformed XML"          | Space after tag         | `<tool>` not `<tool >`              |
| "Parameter missing"      | Mismatched closing tag  | `</uri>` must match `<uri>`         |
| "Incomplete tool call"   | Missing closing tag     | Include `</tool_name>`              |
| "Tool failed to parse"   | Unescaped special chars | Use `&amp;` for `&`, `&lt;` for `<` |

**Debug Examples:**
❌ <read_file> <uri>...</uri></read_file>
Problem: Space after opening tag
✅ <read_file><uri>...</uri></read_file>

❌ <read_file><uri>...</url></read_file>
Problem: Closing tag mismatch (url vs uri)
✅ <read_file><uri>...</uri></read_file>

❌ <search><query>Tom & Jerry</query></search>
Problem: Unescaped ampersand
✅ <search><query>Tom &amp; Jerry</query></search>
```

### 3. **Windows Path Escaping**

**Add this section:**

```markdown
**Windows File Paths:**

Windows paths need escaped backslashes OR forward slashes:

✅ OPTION 1 (escaped backslashes):
<read_file><uri>d:\\Coding\\SafeAppeals\\case_files\\report.pdf</uri></read_file>

✅ OPTION 2 (forward slashes - preferred, no escaping needed):
<read_file><uri>d:/Coding/SafeAppeals/case_files/report.pdf</uri></read_file>

❌ WRONG (single backslash - will fail):
<read_file><uri>d:\Coding\SafeAppeals\case_files\report.pdf</uri></read_file>
```

### 4. **Sequential Tool Calling Guidance**

**Your `prompts.ts` line 614 says:** "You are only allowed to output ONE tool call per response"

**Add examples:**

```markdown
**Sequential Tool Calls:**

Since you can only call ONE tool per response, chain them:

User: "Find and read the medical report"

Response 1:
<rag_search_workspace>
<query>medical report 2024</query>
<limit>5</limit>
</rag_search_workspace>

[Results: Found medical_report_2024.pdf]

Response 2:
<read_file>
<uri>d:/cases/medical_report_2024.pdf</uri>
</read_file>

[File content returned]

Response 3:
Based on the medical report, the key findings are...
```

### 5. **Tool Detection Logic** (xmlParserService.ts)

**Your current parser** (lines 454-490) tries 4 strategies:

1. Custom parser (fastest)
2. Streaming parser (handles incomplete XML)
3. Regex fallback
4. Total failure

**Improvement:** Add these to your `extractGrammar.ts` (around line 393):

```typescript
// Add better detection of common mistakes
const commonMistakes = {
	hasTextBefore: /^[^<]+</.test(fullText),
	hasTextAfter: /<\/[^>]+>[^<]+$/.test(fullText),
	hasCursorFormat:
		fullText.includes("<function_calls>") || fullText.includes("<invoke"),
	hasSpaceAfterTag: /<\w+\s+</.test(fullText),
	hasUnescapedAmpersand:
		/<[^>]+>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)[^<]*<\//.test(fullText),
};

if (Object.values(commonMistakes).some((v) => v)) {
	console.warn("[XML Parser] Common mistake detected:", {
		...commonMistakes,
		hint: "LLM may need better prompt guidance",
	});
}
```

### 6. **Better Error Messages for Users**

**Current:** Technical errors in console
**Needed:** User-facing guidance

**Add to your system** (new file: `userFacingErrorService.ts`):

```typescript
export class UserFacingErrorService {
	static fromParseResult(result: ParseResult): string {
		if (result.strategy === "failed") {
			return `⚠️ Tool call format error. Please try again using this format:

<tool_name>
<param>value</param>
</tool_name>

Common issues:
- Remove all text before/after the XML
- Check for typos in tag names
- Ensure closing tags match opening tags`;
		}

		if (result.recoveryActions && result.recoveryActions.length > 0) {
			return `✅ Tool call parsed (with fixes):
${result.recoveryActions.map((a) => `  - ${a}`).join("\n")}

Consider using the corrected format next time.`;
		}

		return ""; // Success, no user message needed
	}
}
```

---

## Summary: Key Takeaways

### For You (The Developer)

1. **Cursor ≠ Void**: Don't confuse my ANTML format with your simpler XML format
2. **Your system prompt is 80% good** but could be clearer and less repetitive
3. **Your XML parser is excellent** with good fallback strategies
4. **Add user-facing error messages** to help when tool calls fail
5. **Add troubleshooting documentation** in the system prompt

### For Your Void LLM

1. **ONE RULE**: Output ONLY XML, nothing else
2. **Format**: `<tool><param>value</param></tool>` (NO wrappers)
3. **One tool per response** - chain them sequentially
4. **Windows paths**: Use forward slashes or escape backslashes
5. **When in doubt**: Follow the examples in the system prompt EXACTLY

---

## Testing Your Tool Calling

### Test Cases You Should Add

```typescript
describe("Void Tool Calling", () => {
	it("should parse tool with no extra text", () => {
		const xml = "<read_file><uri>test.pdf</uri></read_file>";
		expect(parseSuccessfully(xml)).toBe(true);
	});

	it("should REJECT tool with text before", () => {
		const xml = "Let me read that.\n<read_file><uri>test.pdf</uri></read_file>";
		expect(parseSuccessfully(xml)).toBe(false);
	});

	it("should REJECT tool with text after", () => {
		const xml = "<read_file><uri>test.pdf</uri></read_file>\nHere you go!";
		expect(parseSuccessfully(xml)).toBe(false);
	});

	it("should REJECT Cursor format", () => {
		const xml =
			'<function_calls><invoke name="read_file">...</invoke></function_calls>';
		expect(parseSuccessfully(xml)).toBe(false);
	});

	it("should handle Windows paths with forward slashes", () => {
		const xml = "<read_file><uri>d:/path/to/file.pdf</uri></read_file>";
		expect(parseSuccessfully(xml)).toBe(true);
	});

	it("should handle Windows paths with escaped backslashes", () => {
		const xml =
			"<read_file><uri>d:\\\\path\\\\to\\\\file.pdf</uri></read_file>";
		expect(parseSuccessfully(xml)).toBe(true);
	});
});
```

---

## Next Steps

1. **Update `systemPrompt.ts` lines 81-169** with the improved guidance above
2. **Add `userFacingErrorService.ts`** for better error messages
3. **Add test cases** to validate tool calling behavior
4. **Monitor telemetry** (`xmlParserTelemetry.ts`) to see which strategies are used most
5. **If regex fallback > 10%**: Your system prompt needs improvement

**Overall Assessment**: Your Void system is well-designed! Just needs clearer prompting and better error messages.
