# LiteLLM Configuration

LiteLLM is the AI model proxy that routes requests to providers (OpenAI, Anthropic, xAI, Google).

## File Location

```
void-cloud/litellm/config.yaml
```

The API catalog in `void-cloud/api/src/routes/llm.ts` (`GET /models`) must use the same `model_name` ids — the app forwards `body.model` to LiteLLM unchanged.

## Current Catalog (July 2026)

| model_name | litellm_params.model | Input $/MTok | Output $/MTok |
|------------|----------------------|--------------|---------------|
| `gpt-5.6-sol` | `openai/gpt-5.6-sol` | $5 | $30 |
| `gpt-5.6` | `openai/gpt-5.6-sol` (alias) | $5 | $30 |
| `gpt-5.6-terra` | `openai/gpt-5.6-terra` | $2 | $12 |
| `gpt-5.6-luna` | `openai/gpt-5.6-luna` | $0.20 | $1.20 |
| `gpt-5.4` | `openai/gpt-5.4-2026-03-05` | $2.50 | $15 |
| `gpt-5.2` | `openai/gpt-5.2-2025-12-11` | $1.75 | $14 |
| `claude-opus-5` | `anthropic/claude-opus-5` | $5 | $25 |
| `claude-sonnet-5` | `anthropic/claude-sonnet-5` | $2* | $10* |
| `claude-fable-5` | `anthropic/claude-fable-5` | $10 | $50 |
| `claude-haiku-4-5` | `anthropic/claude-haiku-4-5` | $1 | $5 |
| `claude-opus-4-6` | `anthropic/claude-opus-4-6` | $5 | $25 |
| `claude-sonnet-4-6` | `anthropic/claude-sonnet-4-6` | $3 | $15 |
| `grok-4.5` | `xai/grok-4.5` | $2 | $6 |
| `grok-4.3` | `xai/grok-4.3` | $1.25 | $2.50 |
| `gemini-3-pro` | `gemini/gemini-3.1-pro-preview` | $2 | $12 |
| `gemini-3.6-flash` | `gemini/gemini-3.6-flash` | ~$0.30† | ~$2.50† |
| `gemini-2.5-pro` | `gemini/gemini-2.5-pro` | $1.25 | $10 |
| `gemini-2.5-flash` | `gemini/gemini-2.5-flash` | $0.15 | $0.60 |

\* Sonnet 5 intro pricing thru Aug 31 2026; then $3/$15.  
† Gemini 3.6 Flash costs estimated pending Google publish.

## Configuration Shape

```yaml
# Last Updated: July 2026
model_list:
  - model_name: gpt-5.6-sol
    litellm_params:
      model: openai/gpt-5.6-sol
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      input_cost_per_token: 0.000005     # $5/MTok
      output_cost_per_token: 0.00003     # $30/MTok
      rpm: 500
      tpm: 200000

  - model_name: claude-opus-5
    litellm_params:
      model: anthropic/claude-opus-5
      api_key: os.environ/ANTHROPIC_API_KEY
    model_info:
      input_cost_per_token: 0.000005
      output_cost_per_token: 0.000025
      rpm: 50
      tpm: 40000

  - model_name: grok-4.5
    litellm_params:
      model: xai/grok-4.5
      api_key: os.environ/XAI_API_KEY
    model_info:
      input_cost_per_token: 0.000002
      output_cost_per_token: 0.000006
      rpm: 100
      tpm: 100000

  - model_name: gemini-3-pro
    litellm_params:
      model: gemini/gemini-3.1-pro-preview
      api_key: os.environ/GOOGLE_API_KEY
    model_info:
      input_cost_per_token: 0.000002
      output_cost_per_token: 0.000012
      rpm: 10
      tpm: 32000

litellm_settings:
  set_verbose: false  # Never true in deployment — logs prompt content
  return_usage: true
  cache: false
  request_timeout: 600

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  disable_spend_logs: true
  allow_requests_on_db_unavailable: true
  health_check_details: false
```

Full `model_list` lives in `void-cloud/litellm/config.yaml`.

## Configuration Sections

### model_list

```yaml
- model_name: <alias>              # Name used in API requests
  litellm_params:
    model: <provider>/<model-id>   # Actual provider model
    api_key: os.environ/<VAR>      # API key from environment
  model_info:
    input_cost_per_token: <cost>   # Cost per input token ($/tok)
    output_cost_per_token: <cost>  # Cost per output token ($/tok)
    rpm: <n>
    tpm: <n>
```

### litellm_settings

| Setting | Description | Default |
|---------|-------------|---------|
| `set_verbose` | Enable detailed logging. Logs full request payloads including prompt content — must stay `false` in any deployment handling client data | `false` |
| `return_usage` | Include token usage in response | `true` |
| `cache` | Enable response caching | `false` |
| `request_timeout` | Timeout in seconds | `600` |
| `num_retries` | Max retry attempts | `3` |

### general_settings

| Setting | Description |
|---------|-------------|
| `master_key` | Admin API key for management |
| `disable_spend_logs` | Don't log spending to DB |
| `allow_requests_on_db_unavailable` | Continue if DB is down |
| `health_check_details` | Include details in health endpoint |

## Soft Rate Limits (config defaults)

| Provider | rpm | tpm |
|----------|-----|-----|
| OpenAI | 500 | 200000 |
| Anthropic | 50 | 40000 |
| xAI | 100 | 100000 |
| Gemini Pro | 10 | 32000 |
| Gemini Flash | 15 | 100000 |

## Adding a New Model

1. Get the exact provider model ID (OpenAI / Anthropic / xAI / Google docs).
2. Add an entry to `void-cloud/litellm/config.yaml` with matching `model_name`.
3. Add the same `id` to `GET /models` in `void-cloud/api/src/routes/llm.ts`.
4. Insert a `model_pricing` row (migration under `void-cloud/supabase/migrations/`).
5. Set the provider env key if new (e.g. `XAI_API_KEY`).
6. Redeploy LiteLLM + API.

## Environment Variables

```bash
LITELLM_MASTER_KEY=sk-your-admin-key
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
XAI_API_KEY=xai-...
```

## Cost per Token Format

Costs in config are dollars per token (not per million):

```
$/MTok to $/token:  Divide by 1,000,000
Example: $1.75/MTok = 0.00000175 per token
```

## Running Locally

```bash
cd void-cloud/litellm
docker build -t litellm-proxy .
docker run -p 4000:4000 --env-file ../.env litellm-proxy
```

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.6-sol",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Debugging

`set_verbose: true` is for local development only — never enable against deployments that handle real client data.

**See Also:**
- [Model Pricing](./model-pricing.md)
- [Configuration Guide](./configuration.md)
- [LiteLLM Docs](https://docs.litellm.ai/)
