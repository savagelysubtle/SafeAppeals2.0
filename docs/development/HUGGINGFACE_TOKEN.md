# HuggingFace Authentication for Docling

## The Problem

Docling's ML models (like `ds4sd/docling-layout-heron`) are **gated models** on HuggingFace that require authentication to download.

## Quick Fix: Get a HuggingFace Token

### 1. Create a HuggingFace Account (Free)
- Go to https://huggingface.co/join
- Sign up (takes 30 seconds)

### 2. Create an Access Token
- Go to https://huggingface.co/settings/tokens
- Click "New token"
- Name it: `docling-access`
- Type: **Read** (default)
- Click "Generate token"
- **Copy the token** (starts with `hf_...`)

### 3. Accept the Gated Model Terms
- Visit https://huggingface.co/ds4sd/docling-layout-heron
- Click "Agree and access repository"
- (This gives your account permission to download the model)

### 4. Set the Token in Your Environment

**Windows (PowerShell)**:
```powershell
# Temporary (current session only)
$env:HF_TOKEN="hf_your_token_here"

# Permanent (all sessions)
[System.Environment]::SetEnvironmentVariable('HF_TOKEN', 'hf_your_token_here', 'User')
```

**macOS/Linux (Bash)**:
```bash
# Temporary (current session)
export HF_TOKEN="hf_your_token_here"

# Permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export HF_TOKEN="hf_your_token_here"' >> ~/.bashrc
source ~/.bashrc
```

### 5. Restart SafeAppeals

Close and relaunch SafeAppeals. The token will be automatically detected and used by Docling Serve.

## Verify It's Working

Watch the logs when SafeAppeals starts:

```
[Docling Serve] HuggingFace token found in environment  ← Good!
[Docling Serve] Starting production server 🚀
[Docling Serve] Server started at http://0.0.0.0:5001
```

If you see model downloads succeeding, you're all set!

## Alternative: Use Different Models (Advanced)

If you don't want to create a HuggingFace account, you could configure Docling to use different (public) models, but this requires modifying Docling's configuration files.

## Troubleshooting

**"No HuggingFace token found" warning**:
- The token env variable isn't set
- Restart your terminal/IDE after setting it
- Verify: `echo $env:HF_TOKEN` (Windows) or `echo $HF_TOKEN` (macOS/Linux)

**Still getting 401 errors**:
- Token may be invalid or expired
- Make sure you accepted the model terms (step 3)
- Generate a new token and try again

**Models downloading slowly**:
- First download is ~200MB+ of ML models
- Subsequent runs are instant (models cached)
- Be patient on first run (2-5 minutes)

---

**Last Updated**: November 6, 2025

