# Data Analysis & Research Data

This folder contains CSV files, matrices, and data used for system analysis, performance monitoring, and research.

## Provider & Capability Analysis

- **[void_provider_matrix.csv](./void_provider_matrix.csv)** - Matrix of AI provider capabilities for tool calling, streaming, and native API support

### Coverage:
- Anthropic Claude, OpenAI GPT, Google Gemini
- xAI Grok, Mistral, Groq, DeepSeek
- Local models (Ollama, vLLM, LM Studio)
- Cloud providers (liteLLM, openRouter)

## Streaming Protocol Analysis

- **[streaming_protocols.csv](./streaming_protocols.csv)** - Analysis of different streaming protocols for AI model integration

### Protocols Evaluated:
- Server-Sent Events (SSE)
- WebSocket
- HTTP Streaming
- Custom protocols

## Failure Analysis & Recovery

- **[detection_failures.csv](./detection_failures.csv)** - Analysis of common failure scenarios in capability detection

### Failure Categories:
- Network and authentication issues
- API endpoint problems
- Rate limiting and timeouts
- Configuration mismatches

## Usage

These files are used for:
- **System Design**: Choosing optimal providers and protocols
- **Performance Monitoring**: Tracking success rates and failure patterns
- **Troubleshooting**: Diagnosing integration issues
- **Research**: Analyzing trends in AI provider capabilities

## Data Format

All files are in CSV format for easy analysis with:
- Excel/LibreOffice for manual review
- Python pandas for programmatic analysis
- Database imports for structured queries

## Updates

These matrices should be updated when:
- New AI providers are added
- Provider capabilities change
- New streaming protocols become available
- Performance characteristics shift significantly

## Related Documentation

- **Technical Research**: See `../technical-research/` for implementation details based on this data
- **Development Setup**: See `../development/` for integration guides


