# LiteLLM Configuration

LiteLLM is the AI model proxy that routes requests to various providers (OpenAI, Anthropic, Google, etc.).

## File Location

```
void-cloud/litellm/config.yaml
```

## Current Configuration

```yaml
# LiteLLM Proxy Configuration
# Docs: https://docs.litellm.ai/docs/proxy/configs
# Last Updated: March 2026

model_list:
  # ============================================
  # OPENAI GPT-5.4 (Released Mar 5, 2026)
  # ============================================
  - model_name: gpt-5.4
    litellm_params:
      model: openai/gpt-5.4
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      input_cost_per_token: 0.0000025    # $2.50/MTok
      output_cost_per_token: 0.000015    # $15/MTok

  # ============================================
  # OPENAI GPT-5.2 MODELS (Released Dec 11, 2025)
  # ============================================
  - model_name: gpt-5.2
    litellm_params:
      model: openai/gpt-5.2
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      input_cost_per_token: 0.00000175   # $1.75/MTok
      output_cost_per_token: 0.000014    # $14/MTok

  - model_name: gpt-5.2-pro
    litellm_params:
      model: openai/gpt-5.2-pro
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      input_cost_per_token: 0.000021     # $21/MTok
      output_cost_per_token: 0.000168    # $168/MTok

  # ============================================
  # ANTHROPIC CLAUDE 4.6 MODELS (Released Feb 2026)
  # ============================================
  - model_name: claude-opus-4-6
    litellm_params:
      model: anthropic/claude-opus-4-6
      api_key: os.environ/ANTHROPIC_API_KEY
    model_info:
      input_cost_per_token: 0.000005    # $5/MTok
      output_cost_per_token: 0.000025   # $25/MTok

  - model_name: claude-sonnet-4-6
    litellm_params:
      model: anthropic/claude-sonnet-4-6
      api_key: os.environ/ANTHROPIC_API_KEY
    model_info:
      input_cost_per_token: 0.000003    # $3/MTok
      output_cost_per_token: 0.000015   # $15/MTok

  # ============================================
  # ANTHROPIC CLAUDE 4.5 MODELS (Legacy)
  # ============================================
  - model_name: claude-opus-4-5
    litellm_params:
      model: anthropic/claude-opus-4-5-20251022
      api_key: os.environ/ANTHROPIC_API_KEY
    model_info:
      input_cost_per_token: 0.000005    # $5/MTok
      output_cost_per_token: 0.000025   # $25/MTok

  - model_name: claude-sonnet-4-5
    litellm_params:
      model: anthropic/claude-sonnet-4-5-20250929
      api_key: os.environ/ANTHROPIC_API_KEY
    model_info:
      input_cost_per_token: 0.000003    # $3/MTok
      output_cost_per_token: 0.000015   # $15/MTok

  # ============================================
  # GOOGLE GEMINI MODELS
  # ============================================
  - model_name: gemini-3-pro-preview
    litellm_params:
      model: gemini/gemini-3-pro-preview
      api_key: os.environ/GOOGLE_API_KEY
    model_info:
      input_cost_per_token: 0.000002    # $2/MTok
      output_cost_per_token: 0.000012   # $12/MTok

  - model_name: gemini-2.5-pro
    litellm_params:
      model: gemini/gemini-2.5-pro
      api_key: os.environ/GOOGLE_API_KEY
    model_info:
      input_cost_per_token: 0.00000125  # $1.25/MTok
      output_cost_per_token: 0.00001    # $10/MTok

  - model_name: gemini-2.5-flash
    litellm_params:
      model: gemini/gemini-2.5-flash
      api_key: os.environ/GOOGLE_API_KEY
    model_info:
      input_cost_per_token: 0.00000015  # $0.15/MTok
      output_cost_per_token: 0.0000006  # $0.60/MTok

litellm_settings:
  set_verbose: true
  return_usage: true
  cache: false
  request_timeout: 600  # 10 minute timeout

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  disable_spend_logs: true
  allow_requests_on_db_unavailable: true
  health_check_details: false
```

## Configuration Sections

### model_list

Defines available models and their routing:

```yaml
- model_name: <alias>              # Name used in API requests
  litellm_params:
    model: <provider>/<model-id>   # Actual provider model
    api_key: os.environ/<VAR>      # API key from environment
    api_base: <url>                # Optional: custom endpoint
  model_info:
    input_cost_per_token: <cost>   # Cost per input token
    output_cost_per_token: <cost>  # Cost per output token
```

### litellm_settings

Runtime behavior settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `set_verbose` | Enable detailed logging | `false` |
| `return_usage` | Include token usage in response | `true` |
| `cache` | Enable response caching | `false` |
| `request_timeout` | Timeout in seconds | `600` |

### general_settings

Proxy-wide settings:

| Setting | Description |
|---------|-------------|
| `master_key` | Admin API key for management |
| `disable_spend_logs` | Don't log spending to DB |
| `allow_requests_on_db_unavailable` | Continue if DB is down |
| `health_check_details` | Include details in health endpoint |

## Adding a New Model

### Step 1: Get Provider Details

Find the exact model ID from the provider:
- OpenAI: https://platform.openai.com/docs/models
- Anthropic: https://docs.anthropic.com/en/docs/models
- Google: https://ai.google.dev/gemini-api/docs/models

### Step 2: Add to Config

```yaml
- model_name: new-model-alias
  litellm_params:
    model: provider/exact-model-id
    api_key: os.environ/PROVIDER_API_KEY
  model_info:
    input_cost_per_token: 0.000001    # Check provider pricing
    output_cost_per_token: 0.000003
```

### Step 3: Add API Key

Set the environment variable:

```bash
# In Railway or .env
PROVIDER_API_KEY=sk-...
```

### Step 4: Redeploy

```bash
git add void-cloud/litellm/config.yaml
git commit -m "Add new-model-alias"
git push
```

## Provider-Specific Configuration

### OpenAI

```yaml
- model_name: gpt-4o
  litellm_params:
    model: openai/gpt-4o
    api_key: os.environ/OPENAI_API_KEY
```

### OpenAI-Compatible (Custom Endpoint)

```yaml
- model_name: local-llama
  litellm_params:
    model: openai/llama-3-70b
    api_key: fake-key
    api_base: http://localhost:8000/v1
```

### Anthropic

```yaml
- model_name: claude-3-opus
  litellm_params:
    model: anthropic/claude-3-opus-20240229
    api_key: os.environ/ANTHROPIC_API_KEY
```

### Google Gemini

```yaml
- model_name: gemini-pro
  litellm_params:
    model: gemini/gemini-1.5-pro
    api_key: os.environ/GOOGLE_API_KEY
```

### Azure OpenAI

```yaml
- model_name: azure-gpt-4
  litellm_params:
    model: azure/gpt-4-deployment-name
    api_key: os.environ/AZURE_API_KEY
    api_base: https://your-resource.openai.azure.com
    api_version: 2024-02-01
```

### Ollama (Local)

```yaml
- model_name: ollama-llama3
  litellm_params:
    model: ollama/llama3
    api_base: http://localhost:11434
```

## Cost Tracking

### Cost per Token Format

Costs are specified in dollars per token (not per million):

```yaml
input_cost_per_token: 0.000001  # = $1.00 per 1M tokens
```

### Conversion

```
$/MTok to $/token:  Divide by 1,000,000
$/token to $/MTok:  Multiply by 1,000,000

Example:
$1.75/MTok = $1.75 / 1,000,000 = 0.00000175 per token
```

### Pricing Reference

| Rate | Per Token | Per 1K Tokens | Per 1M Tokens |
|------|-----------|---------------|---------------|
| $0.15/MTok | 0.00000015 | $0.00015 | $0.15 |
| $1.00/MTok | 0.000001 | $0.001 | $1.00 |
| $5.00/MTok | 0.000005 | $0.005 | $5.00 |
| $15.00/MTok | 0.000015 | $0.015 | $15.00 |

## Load Balancing

### Multiple Deployments

```yaml
- model_name: gpt-4o
  litellm_params:
    model: openai/gpt-4o
    api_key: os.environ/OPENAI_API_KEY_1

- model_name: gpt-4o
  litellm_params:
    model: openai/gpt-4o
    api_key: os.environ/OPENAI_API_KEY_2
```

LiteLLM automatically load-balances between same-named models.

### Fallback Models

```yaml
- model_name: main-model
  litellm_params:
    model: openai/gpt-4o
    api_key: os.environ/OPENAI_API_KEY
  model_info:
    fallback_models: ["backup-model"]

- model_name: backup-model
  litellm_params:
    model: anthropic/claude-3-sonnet
    api_key: os.environ/ANTHROPIC_API_KEY
```

## Environment Variables

### Required

```bash
LITELLM_MASTER_KEY=sk-your-admin-key
```

### Provider Keys (as needed)

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
XAI_API_KEY=xai-...
AZURE_API_KEY=...
```

## Running Locally

### With Docker

```bash
cd void-cloud/litellm
docker build -t litellm-proxy .
docker run -p 4000:4000 --env-file .env litellm-proxy
```

### With Python

```bash
pip install litellm[proxy]
litellm --config config.yaml --port 4000
```

### Testing

```bash
curl http://localhost:4000/health

curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.2",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Debugging

### Enable Verbose Logging

```yaml
litellm_settings:
  set_verbose: true
```

### Check Logs

```bash
# Railway logs
railway logs

# Docker logs
docker logs <container-id>
```

### Common Issues

**Model not found:**
- Check `model_name` matches exactly
- Verify provider prefix is correct

**Authentication failed:**
- Check API key environment variable is set
- Verify key is valid and has credits

**Timeout errors:**
- Increase `request_timeout`
- Check network connectivity to provider

---

**See Also:**
- [Model Pricing](./model-pricing.md)
- [Configuration Guide](./configuration.md)
- [LiteLLM Docs](https://docs.litellm.ai/)

