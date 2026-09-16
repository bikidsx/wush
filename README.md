# Wush 🚀

AI-powered Git workflow CLI that generates meaningful commits, creates PRs, and scans for vulnerabilities.

[![npm version](https://badge.fury.io/js/wush-cli.svg)](https://www.npmjs.com/package/wush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install -g wush
```

## Quick Start

```bash
# First run will guide you through setup
wush commit
```

## Commands

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

### Branch Creation
```bash
wush branch    # or wush b
```
Create branches with AI-generated names based on your task description.

### Push & Pull
```bash
wush push      # or wush p
wush pull      # or wush l
wush pull -r   # Pull with rebase
```
Push and pull changes with smart defaults and safety prompts.

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

Wush does not ship a fixed model list. Models are discovered from your provider
at runtime, so a model works the day it ships.

| Provider | Auth | Model discovery |
|----------|------|-----------------|
| **OpenAI** | `OPENAI_API_KEY` | live |
| **Anthropic** | `ANTHROPIC_API_KEY` | live |
| **Google** | `GOOGLE_GENERATIVE_AI_API_KEY` | live |
| **Groq** | `GROQ_API_KEY` | live |
| **Azure OpenAI** | `AZURE_API_KEY` | deployment name (Azure exposes no list) |
| **Ollama** | none — local | live |
| **Vercel AI Gateway** | `AI_GATEWAY_API_KEY` | live, every major model via one key |
| **Any OpenAI-compatible endpoint** | optional | live |

The last row is the important one: LM Studio, OpenRouter, vLLM, LiteLLM,
DeepSeek, xAI, Together, and any self-hosted OpenAI-format server work by
adding an endpoint, with no new dependency and no wush release.

```bash
wush providers            # what's configured and ready
wush models               # what your provider currently offers
wush models -p ollama -r  # inspect another provider, bypassing the cache
wush config               # switch provider/model, or add a custom endpoint
```

API keys are read from the environment first and only stored in config if you
choose to enter them interactively.

## First Run Setup

On first run, Wush will guide you through:
1. Select AI provider
2. Enter API key (skip for Ollama)
3. Choose default model
4. Configure git preferences
5. Connect GitHub (optional, for PR features)

## Features

- 🤖 **AI-Powered Commits** - Generate meaningful commit messages from your changes
- 🔀 **Smart PRs** - Auto-generate PR titles and descriptions
- 🌿 **Branch Creation** - AI-suggested branch names based on task description
- 🔒 **Security Scanning** - Detect vulnerabilities before they ship
- 🎨 **Live TUI** - Watch the message being written, cancel mid-flight with `esc`
- ⚡ **Any Provider, Any Model** - Built on the Vercel AI SDK; models are
  discovered at runtime, and any OpenAI-compatible endpoint can be added
- 🔧 **Conventional Commits** - Enforced by a schema, not by string parsing

## Security Scanning

Wush detects common vulnerabilities:
- SQL Injection
- XSS (Cross-Site Scripting)
- Hardcoded secrets & API keys
- Weak cryptography
- Command injection
- Path traversal
- And more...

## License

MIT © [bikidsx](https://github.com/bikidsx)
