# Wush - AI-Powered Git Workflow CLI

## Overview
A beautiful terminal app that uses AI to understand git changes and create meaningful commits, PRs, and streamline git workflows.

## Core Features

### 1. Smart Commits
- `wush commit` or `wush c` - Analyze staged changes and generate meaningful commit messages
- AI reads the diff and understands context
- Interactive mode to review/edit before committing
- Support for conventional commits format
- Multi-file change summarization

### 2. PR Management
- `wush pr --dev` - Create PR to dev branch
- `wush pr --main` - Create PR to main branch
- `wush pr` - Interactive branch selection
- Auto-generate PR title and description from commits
- AI-enhanced PR descriptions with context

### 3. Security & Code Quality
- `wush scan` or `wush s` - Scan code for vulnerabilities
- `wush review` - AI code review before commit
- Detect security issues (SQL injection, XSS, hardcoded secrets)
- Check for outdated dependencies
- OWASP Top 10 vulnerability detection
- Best practices validation

### 4. Additional Commands
- `wush status` - Enhanced git status with AI insights
- `wush config` - Configure AI provider, preferences
- `wush help` - Interactive help system

## Tech Stack

### Core
- **Node.js + TypeScript** - Runtime with type safety
- **Commander.js** - CLI framework
- **Chalk** - Terminal styling
- **Inquirer.js** - Interactive prompts
- **Ora** - Elegant spinners

### Git Integration
- **simple-git** - Git operations
- **parse-diff** - Parse git diffs

### AI Integration (User Choice on First Run)
- **OpenAI** - GPT-5, GPT-5 mini, GPT-5 nano, gpt-oss-120b/20b (open-weight)
- **Anthropic** - Claude Sonnet 4.5 (coding excellence), Claude Haiku 4.5 (fast)
- **Google** - Gemini 2.5 Pro, Gemini 2.5 Flash (with Deep Think mode)
- **Ollama** - Local models: Llama 3.3 70B, Llama 3.1 405B, Qwen3 72B
- **Groq** - Fast inference: gpt-oss-120B, gpt-oss-20B, Llama 4

### UI/UX
- **Chalk** - Colors and styling
- **Boxen** - Beautiful boxes
- **Gradient-string** - Gradient text
- **Cli-table3** - Tables for status
- **Figures** - Unicode symbols

## Project Structure

```
wush/
├── bin/
│   └── wush.js              # Entry point (compiled)
├── src/
│   ├── commands/
│   │   ├── commit.ts        # Commit command
│   │   ├── pr.ts            # PR command
│   │   ├── scan.ts          # Vulnerability scanner
│   │   ├── review.ts        # Code review command
│   │   ├── status.ts        # Status command
│   │   └── config.ts        # Config command
│   ├── services/
│   │   ├── ai/
│   │   │   ├── base.ts      # Base AI provider interface
│   │   │   ├── openai.ts    # OpenAI implementation
│   │   │   ├── anthropic.ts # Claude implementation
│   │   │   ├── google.ts    # Gemini implementation
│   │   │   ├── ollama.ts    # Ollama implementation
│   │   │   ├── groq.ts      # Groq implementation
│   │   │   └── factory.ts   # Provider factory
│   │   ├── security/
│   │   │   ├── scanner.ts   # Vulnerability scanner
│   │   │   ├── patterns.ts  # Security patterns & rules
│   │   │   └── analyzer.ts  # Code analysis engine
│   │   ├── git.ts           # Git operations
│   │   └── github.ts        # GitHub API integration
│   ├── utils/
│   │   ├── logger.ts        # Styled console output
│   │   ├── config.ts        # Config management
│   │   ├── prompts.ts       # Interactive prompts
│   │   └── setup.ts         # First-run setup wizard
│   ├── types/
│   │   └── index.ts         # TypeScript types/interfaces
│   └── index.ts             # Main CLI setup
├── dist/                    # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Project setup with TypeScript
- [ ] CLI framework with Commander
- [ ] First-run setup wizard (LLM provider selection + API key)
- [ ] Basic git integration (status, diff)
- [ ] Beautiful terminal UI with Chalk
- [ ] Config management (API keys, preferences)
- [ ] AI provider abstraction layer

### Phase 2: Smart Commits (Week 2)
- [ ] Git diff parsing
- [ ] AI integration for commit message generation
- [ ] Interactive commit flow
- [ ] Conventional commits support
- [ ] Commit history analysis

### Phase 3: PR Management (Week 3)
- [ ] GitHub API integration
- [ ] PR creation workflow
- [ ] AI-generated PR descriptions
- [ ] Branch detection and selection
- [ ] PR templates support

### Phase 4: Security Scanner (Week 4)
- [ ] Vulnerability detection engine
- [ ] AI-powered security analysis
- [ ] Pattern matching for common vulnerabilities
- [ ] Dependency vulnerability checking
- [ ] Security report generation
- [ ] Integration with commit workflow

### Phase 5: Polish & Features (Week 5)
- [ ] Error handling and validation
- [ ] Performance optimization
- [ ] Configuration wizard improvements
- [ ] Documentation and examples
- [ ] CI/CD integration guides

## User Experience Flow

### First Run Setup
```bash
$ wush commit
👋 Welcome to Wush! Let's get you set up.

? Select your AI provider:
  ❯ OpenAI (GPT-5, GPT-5 mini, GPT-5 nano)
    Anthropic (Claude Sonnet 4.5, Haiku 4.5)
    Google (Gemini 2.5 Pro, Gemini 2.5 Flash)
    Ollama (Local - Free: Llama 3.3 70B, Qwen3 72B)
    Groq (Fast inference: gpt-oss-120B, Llama 4)

? Enter your OpenAI API key: sk-...
? Select default model:
  ❯ gpt-5 (Frontier model for coding)
    gpt-5-mini (Balanced performance)
    gpt-5-nano (Fast & efficient)
    gpt-oss-120b (Open-weight)
    gpt-oss-20b (Open-weight)

? Enable conventional commits? (Y/n) Y
? Connect to GitHub for PR features? (Y/n) Y
? Enter your GitHub token: ghp_...

✅ Setup complete! Running your command...
```

### Commit Flow
```bash
$ wush commit
🔍 Analyzing changes...
📝 Found changes in 3 files

✨ Suggested commit message:
feat(auth): implement JWT token refresh mechanism

- Add token refresh endpoint
- Update auth middleware to handle expired tokens
- Add tests for token refresh flow

[E]dit  [A]ccept  [R]egenerate  [C]ancel
```

### PR Flow
```bash
$ wush pr --dev
🔍 Analyzing commits since dev...
📊 Found 5 commits to include

✨ Generated PR:
Title: Feature: User Authentication System
Description:
Implements complete authentication system with:
- JWT token management
- Password hashing with bcrypt
- Session handling
- OAuth integration

[E]dit  [C]reate  [P]review  [C]ancel
```

### Security Scan Flow
```bash
$ wush scan
🔍 Scanning codebase for vulnerabilities...

📊 Analyzing 47 files...
🔐 Checking for security issues...

⚠️  Found 3 potential vulnerabilities:

┌─────────────────────────────────────────────────────────────┐
│ HIGH: SQL Injection Risk                                    │
├─────────────────────────────────────────────────────────────┤
│ File: src/db/users.ts:45                                    │
│ Issue: Unsanitized user input in SQL query                  │
│                                                              │
│   const query = `SELECT * FROM users WHERE id = ${userId}`  │
│                                                              │
│ Fix: Use parameterized queries or ORM                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ MEDIUM: Hardcoded Secret                                    │
├─────────────────────────────────────────────────────────────┤
│ File: src/config/api.ts:12                                  │
│ Issue: API key hardcoded in source                          │
│                                                              │
│   const API_KEY = "sk-1234567890abcdef"                     │
│                                                              │
│ Fix: Use environment variables                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LOW: Outdated Dependency                                    │
├─────────────────────────────────────────────────────────────┤
│ Package: express@4.17.1                                     │
│ Issue: Known vulnerability CVE-2022-24999                   │
│                                                              │
│ Fix: Update to express@4.18.2 or higher                     │
└─────────────────────────────────────────────────────────────┘

📝 Summary:
   High: 1  Medium: 1  Low: 1

[F]ix automatically  [R]eport  [I]gnore  [E]xit
```

## Configuration

### ~/.wushrc.json
```json
{
  "version": "1.0.0",
  "setupComplete": true,
  "ai": {
    "provider": "openai",
    "model": "gpt-5",
    "apiKey": "sk-...",
    "temperature": 0.7,
    "maxTokens": 500
  },
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "defaultModel": "gpt-5",
      "models": ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-oss-120b", "gpt-oss-20b"]
    },
    "anthropic": {
      "apiKey": "",
      "defaultModel": "claude-sonnet-4.5",
      "models": ["claude-sonnet-4.5", "claude-haiku-4.5"]
    },
    "google": {
      "apiKey": "",
      "defaultModel": "gemini-2.5-pro",
      "models": ["gemini-2.5-pro", "gemini-2.5-flash"],
      "features": {
        "deepThink": true
      }
    },
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "defaultModel": "llama3.3:70b",
      "models": ["llama3.3:70b", "llama3.1:405b", "qwen3:72b", "gpt-oss-120b", "gpt-oss-20b"]
    },
    "groq": {
      "apiKey": "",
      "defaultModel": "gpt-oss-120b",
      "models": ["gpt-oss-120b", "gpt-oss-20b", "llama-4"]
    }
  },
  "git": {
    "conventionalCommits": true,
    "autoStage": false
  },
  "github": {
    "token": "ghp_...",
    "defaultBranch": "main"
  },
  "ui": {
    "theme": "default",
    "emoji": true
  },
  "security": {
    "scanOnCommit": false,
    "autoFix": false,
    "ignorePatterns": ["*.test.ts", "*.spec.ts"],
    "severity": {
      "blockOnHigh": true,
      "blockOnMedium": false,
      "blockOnLow": false
    }
  }
}
```

## Key Dependencies

```json
{
  "dependencies": {
    "commander": "^11.0.0",
    "chalk": "^5.3.0",
    "inquirer": "^9.2.0",
    "ora": "^7.0.0",
    "simple-git": "^3.20.0",
    "openai": "^4.20.0",
    "@anthropic-ai/sdk": "^0.20.0",
    "@google/generative-ai": "^0.2.0",
    "groq-sdk": "^0.3.0",
    "ollama": "^0.5.0",
    "@octokit/rest": "^20.0.0",
    "parse-diff": "^0.11.0",
    "boxen": "^7.1.0",
    "gradient-string": "^2.0.2",
    "cli-table3": "^0.6.3",
    "figures": "^6.0.0",
    "conf": "^12.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "semver": "^7.5.0",
    "node-fetch": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "@types/inquirer": "^9.0.0",
    "@types/gradient-string": "^1.1.0",
    "tsx": "^4.7.0",
    "tsup": "^8.0.0"
  }
}
```

## Security Considerations
- Store API keys securely (system keychain)
- Never commit sensitive data
- Validate all git operations
- Rate limiting for AI calls
- Token encryption at rest

## Security Detection Capabilities

### Vulnerability Types
- **Injection Attacks**: SQL, NoSQL, Command injection, XSS
- **Authentication Issues**: Weak passwords, missing auth, insecure sessions
- **Sensitive Data**: Hardcoded secrets, API keys, passwords, tokens
- **Cryptography**: Weak algorithms, insecure random, broken crypto
- **Dependencies**: Outdated packages, known CVEs
- **Configuration**: Insecure defaults, exposed endpoints
- **Code Quality**: Unsafe functions, eval usage, prototype pollution

### Detection Methods
- AI-powered contextual analysis
- Pattern matching with regex rules
- AST (Abstract Syntax Tree) parsing
- Dependency vulnerability databases
- OWASP Top 10 compliance checking

## Future Enhancements
- Commit message templates
- Team conventions learning
- GitLab/Bitbucket support
- Commit history insights
- Branch naming suggestions
- Conflict resolution assistance
- Release notes generation
- Security compliance reports
- Custom security rules
- Integration with SAST tools
