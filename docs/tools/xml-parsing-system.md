# XML Parsing System

Comprehensive documentation for the multi-level XML tool parsing system, including streaming support, error recovery, validation, and performance monitoring.

## Overview

The XML parsing system enables robust extraction of tool calls from AI model responses using a hierarchical fallback approach:

1. **Custom Parser**: Fast parsing for well-formed XML
2. **Streaming Parser**: Handles incomplete/malformed XML from streaming responses
3. **Regex Fallback**: Last resort extraction for severely malformed content
4. **Failure Reporting**: Detailed error analysis and recovery tracking

## Architecture

### Core Components

```
xml-parsing/
├── xmlParserService.ts       # Main parser service with fallback logic
├── extractGrammar.ts         # Grammar extraction and tool call parsing
├── toolSchemaValidator.ts    # Parameter validation and error handling
└── xmlParserTelemetry.ts     # Performance monitoring and metrics
```

### XMLParserService

The main orchestration service that manages parsing strategies.

```typescript
class XMLParserService {
  // Parser strategies in priority order
  private strategies = [
    new CustomXMLParser(),      // Fastest for well-formed XML
    new StreamingXMLParser(),   // Handles incomplete XML
    new RegexFallbackParser(),  // Last resort extraction
  ];

  async parse(xmlContent: string): Promise<ParseResult> {
    for (const strategy of this.strategies) {
      try {
        const result = await strategy.parse(xmlContent);
        if (result.success) {
          return result;
        }
      } catch (error) {
        // Log error and try next strategy
      }
    }

    return { success: false, errors: ['All parsing strategies failed'] };
  }
}
```

## Parsing Strategies

### Strategy 1: Custom Parser

**Purpose**: Fast parsing for well-formed XML from reliable sources.

**Characteristics:**
- Fastest parsing performance
- Strict XML compliance required
- Minimal error recovery
- Best for production environments

**Implementation:**
```typescript
class CustomXMLParser {
  parse(xmlContent: string): ParseResult {
    // Custom XML parsing logic
    // - Validates XML structure
    // - Extracts tool calls
    // - Returns structured data
  }
}
```

### Strategy 2: Streaming Parser

**Purpose**: Robust parsing for incomplete or malformed XML from streaming responses.

**Characteristics:**
- Handles partial XML chunks
- Streaming-friendly processing
- Advanced error recovery
- Uses `partial-xml-stream-parser` library

**Key Features:**
- **Incremental parsing**: Processes XML as it arrives
- **Buffer management**: Handles streaming interruptions
- **Tag balancing**: Tracks opening/closing tag pairs
- **Content preservation**: Maintains original formatting

### Strategy 3: Regex Fallback

**Purpose**: Last resort extraction for severely malformed XML.

**Characteristics:**
- Pattern-based extraction
- No XML structure validation
- High false positive rate
- Emergency fallback only

**Regex Patterns:**
```typescript
const TOOL_CALL_PATTERN = /<tool_call\s+name="([^"]+)">(.*?)<\/tool_call>/gs;
const PARAMETER_PATTERN = /<parameter\s+name="([^"]+)">(.*?)<\/parameter>/gs;
```

## Error Recovery Mechanisms

### XML Sanitization

**Purpose**: Automatically fix common XML formatting issues.

**Recoveries Applied:**
- **Unescaped characters**: Converts `&`, `<`, `>`, `"`, `'` to entities
- **Mismatched quotes**: Fixes inconsistent quote usage
- **Whitespace normalization**: Standardizes spacing

**Example:**
```typescript
// Input: <tool_call name="read_file"><parameter name="uri">file://path
