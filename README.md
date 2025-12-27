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

| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-5, GPT-5 mini, GPT-5 nano |
| **Anthropic** | Claude Sonnet 4.5, Claude Haiku 4.5 |
| **Google** | Gemini 2.5 Pro, Gemini 2.5 Flash |
| **Ollama** | Llama 3.3 70B, Qwen3 72B (Local - Free) |
| **Groq** | gpt-oss-120B, Llama 4 (Fast inference) |

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
- 🎨 **Beautiful UI** - Sleek terminal interface with colors and animations
- ⚡ **Multiple AI Providers** - Choose your preferred AI (OpenAI, Claude, Gemini, Ollama, Groq)
- 🔧 **Conventional Commits** - Follow best practices automatically

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
