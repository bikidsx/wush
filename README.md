# Wush 🚀

AI-powered Git workflow CLI that generates meaningful commits, creates PRs, and scans for vulnerabilities.

## Installation

```bash
bun install
bun link
```

## Usage

### Smart Commits
```bash
wush commit    # or wush c
```
Analyzes staged changes and generates AI-powered commit messages.

### Create PRs
```bash
wush pr --dev      # PR to dev branch
wush pr --main     # PR to main branch
wush pr            # Interactive branch selection
```

### Security Scan
```bash
wush scan    # or wush s
```
Scans codebase for vulnerabilities (SQL injection, XSS, hardcoded secrets, etc.)

### Status
```bash
wush status
```
Enhanced git status with color-coded output.

### Configuration
```bash
wush config
```
Configure AI provider, model, GitHub token, and preferences.

## Supported AI Providers

- **OpenAI** - GPT-5, GPT-5 mini, GPT-5 nano
- **Anthropic** - Claude Sonnet 4.5, Claude Haiku 4.5
- **Google** - Gemini 2.5 Pro, Gemini 2.5 Flash
- **Ollama** - Local models (Llama 3.3 70B, Qwen3 72B)
- **Groq** - Fast inference (gpt-oss-120B, Llama 4)

## First Run

On first run, Wush will guide you through setup:
1. Select AI provider
2. Enter API key
3. Choose default model
4. Configure git preferences
5. Connect GitHub (optional)

## License

MIT
