<div align="center">

# Wush

**AI-powered Git workflow CLI — meaningful commits, real pull requests, any model you like.**

[![npm version](https://img.shields.io/npm/v/wush.svg)](https://www.npmjs.com/package/wush)
[![license](https://img.shields.io/badge/license-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

</div>

---

Wush reads your staged diff and writes the commit message you were going to write
anyway — then gets out of the way. It also opens pull requests, names branches,
and scans for vulnerabilities.

It is built on the [Vercel AI SDK](https://ai-sdk.dev), so it is not tied to one
vendor. Bring OpenAI, Anthropic, Google, Groq, Azure, a local Ollama model, the
Vercel AI Gateway, or any OpenAI-compatible endpoint you can reach — or skip API
keys entirely and use a Claude Pro/Max or ChatGPT Plus/Pro subscription you
already pay for.

```console
$ wush commit

wush · commit
────────────────────────────
3 files staged

⠹ Writing commit message  1.4s
  ▰▰▰▱▱  esc to cancel
  › add token refresh endpoint

╭──────────────────────────────────────────────╮
│ feat(auth): add token refresh endpoint       │
│                                              │
│ Sessions previously expired with no renewal  │
│ path, forcing a full re-login.               │
╰──────────────────────────────────────────────╯

❯ Accept and commit [a]
  Edit before committing [e]
  Regenerate [r]
  Cancel [c]

• OpenAI · gpt-5.4-mini · 1284↑ 87↓
```

## Why it's different

**No hardcoded model list.** Models are discovered from your provider at
runtime, so a model works the day it ships — no wush release required.
Deprecated and non-text models are filtered out using signals the provider
itself reports.

**Any endpoint, not just the big names.** LM Studio, OpenRouter, vLLM, LiteLLM,
DeepSeek, xAI, Together, or your own gateway all work by adding a base URL.

**Schema-validated output.** Commit messages and PR bodies come back as typed,
validated objects rather than prose that gets parsed with regexes. A malformed
answer fails loudly instead of producing a mangled commit.

**Streaming, cancellable UI.** You see the message being written, with real
elapsed time and token counts. `esc` genuinely aborts the request. The
full-screen interface currently backs `wush commit`; the other commands use
prompt-based output and are being migrated.

## Install

```bash
npm install -g wush
```

Requires Node.js 18 or newer.

## Quick start

```bash
export OPENAI_API_KEY=sk-...   # or any provider below
cd your-repo
git add .
wush commit
```

First run walks you through picking a provider, a model, and (optionally) a
GitHub token. Keys already present in your environment are detected and never
written to disk.

## Commands

| Command | Alias | What it does |
|---|---|---|
| `wush commit` | `c` | Generate a commit message from staged changes |
| `wush pr` | | Open a pull request with a generated title and body |
| `wush branch` | `b` | Create a branch with an AI-suggested name |
| `wush push` | `p` | Push, with force-push and upstream guards |
| `wush pull` | `l` | Pull, warning before it touches uncommitted work |
| `wush scan` | `s` | Scan the codebase for vulnerability patterns |
| `wush status` | | Enhanced `git status` |
| `wush models` | | List what your provider currently offers |
| `wush providers` | | Show every provider and whether it is ready |
| `wush config` | | Change provider, model, keys, and preferences |

### `wush commit`

Analyses the staged diff and proposes a [Conventional
Commits](https://www.conventionalcommits.org/) message. Accept, edit inline,
regenerate, or cancel. If nothing is staged, it offers to stage everything.

The commit type is constrained by a schema to `feat`, `fix`, `docs`, `style`,
`refactor`, `perf`, `test`, `build`, `ci`, or `chore` — the model cannot invent
a type.

### `wush pr`

```bash
wush pr                    # pick the target branch interactively
wush pr --main             # target main
wush pr --dev              # target dev
wush pr --staging          # target staging
wush pr -t release/v2      # target any branch
```

Diffs your branch against the target, summarises the commits, and generates a
title plus a structured body (Summary / Changes / Testing / Notes). Requires a
GitHub token.

### `wush branch`

```bash
wush branch                        # interactive
wush branch -n hotfix-login        # explicit name
wush branch -t feature             # preselect the type
```

Describe the work in plain language and get a kebab-case branch name under the
conventional prefix (`feature/`, `fix/`, `hotfix/`, `release/`, `chore/`,
`docs/`, `refactor/`, `test/`).

### `wush push` / `wush pull`

```bash
wush push          # sets upstream automatically if the branch has none
wush push -f       # force push, after an explicit confirmation
wush pull -r       # rebase instead of merge
```

Force pushing asks first and explains that remote commits can be lost. Pulling
onto a dirty tree lists the affected files before proceeding.

### `wush models` / `wush providers`

```bash
wush providers            # which providers are configured and ready
wush models               # what the active provider offers right now
wush models -p ollama     # inspect another provider
wush models -r            # bypass the 24-hour cache and refetch
wush models -a            # include deprecated and non-text models
```

## Providers and models

Wush ships no fixed model list. Each provider is queried at runtime.

| Provider | Auth | Model discovery |
|---|---|---|
| **OpenAI** | `OPENAI_API_KEY` | live |
| **Anthropic** | `ANTHROPIC_API_KEY` | live |
| **Google** | `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY` | live |
| **Groq** | `GROQ_API_KEY` | live |
| **Azure OpenAI** | `AZURE_API_KEY` or `AZURE_OPENAI_API_KEY` | deployment name — Azure exposes no list endpoint |
| **Ollama** | none, runs locally | live |
| **Claude subscription** | your Claude login, via the `claude` CLI | model aliases |
| **ChatGPT subscription** | your ChatGPT login, via the `codex` CLI | live |
| **Vercel AI Gateway** | `AI_GATEWAY_API_KEY` | live — every major model behind one key |
| **Any OpenAI-compatible endpoint** | optional | live |

That last row is the point: anything speaking the OpenAI wire format works
without a new dependency or a wush release.

```bash
wush config   # → "Add a custom endpoint"
```

You supply a name, a base URL, and either an environment variable name or a key.
The endpoint then behaves like any built-in provider, including model discovery.

### Using a Claude or ChatGPT subscription instead of an API key

If you already pay for Claude Pro/Max or ChatGPT Plus/Pro, wush can use that
subscription instead of a metered API key.

```bash
# Claude Pro / Max
npm install -g @anthropic-ai/claude-code
claude login
wush config          # choose "Claude subscription"

# ChatGPT Plus / Pro
npm install -g @openai/codex
codex login
wush config          # choose "ChatGPT subscription"
```

**How this works, and why it works this way.** wush does not implement its own
"Sign in with ChatGPT/Claude" flow. It delegates to the vendor's own CLI, which
you have already authenticated. Your subscription credentials stay in that CLI's
credential store — wush never sees, stores, or transmits a token.

That is a deliberate choice. Reimplementing those OAuth flows means presenting
yourself as the vendor's first-party client, which is not sanctioned (OpenAI's
Codex source distinguishes first-party originators, and the ToS question for
third-party clients remains formally unanswered). If a vendor enforced against
it, the account suspended would be *yours*. Delegating to the official CLI
avoids that entirely.

Two consequences worth knowing:

- These providers are `optionalDependencies` requiring **Node.js 22+**. They are
  not installed into the bundle, so nothing changes for API-key users on Node 18.
- The CLIs do not accept `temperature` or an output token cap, so wush omits
  those settings for these providers rather than sending values that are ignored.

If the CLI is installed but not signed in, wush tells you to run `claude login`
or `codex login` rather than sending you to `wush config`.

### How deprecated models get filtered

Filtering is driven **only** by what each API reports — there is deliberately no
curated blocklist of model names, since such a list is wrong the moment a
provider ships or retires something.

- The AI Gateway reports a `modelType`, so non-language models are excluded outright.
- Google reports `supportedGenerationMethods`, distinguishing chat from embedding models.
- OpenAI-format endpoints may report `created` (used to sort newest first) and
  some report `active`, which marks retired models.
- Providers that state deprecation in a model's description are detected from that text.

Anything hidden is still reachable with `wush models --all`, and the picker
offers a "Show all" option — a filter should never trap you.

### Local models

```bash
ollama serve
ollama pull llama3.3
wush config          # choose Ollama
```

No API key required. Note that small local models are much weaker at structured
output; if generation fails repeatedly, try a larger model.

## Configuration

### Environment variables

Environment variables always take precedence over stored config, which keeps
secrets out of `config.json` and makes CI straightforward.

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GOOGLE_GENERATIVE_AI_API_KEY` / `GEMINI_API_KEY` | Google |
| `GROQ_API_KEY` | Groq |
| `AZURE_API_KEY` / `AZURE_OPENAI_API_KEY` | Azure OpenAI |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway |
| `GITHUB_TOKEN` | Pull request creation |
| `WUSH_CONFIG_DIR` | Override where config is stored |

> **Note on stored keys.** If you enter a key interactively it is written in
> plain text to the config file managed by
> [`conf`](https://github.com/sindresorhus/conf). Prefer environment variables
> on shared machines.

### `wush config`

Covers provider and model switching, credentials, custom endpoints, refreshing
model lists, git preferences, the GitHub token, custom instructions, security
settings, and interface options.

### Custom instructions

Add house rules that are appended to every request:

```
"Always include the Jira ticket, e.g. PROJ-123"
"Keep subjects under 50 characters"
"Always add a Testing section to PR descriptions"
```

Set them under `wush config` → Custom instructions.

## Non-interactive use

The streaming interface needs a real terminal. When stdout is piped, `CI` is
set, or `TERM=dumb`, wush automatically falls back to plain prompts and line
output. You can also disable it permanently under `wush config` → Interface
settings.

## Security scanning

`wush scan` matches a library of vulnerability patterns across your source and
reports findings grouped by severity, with an optional JSON report.

Detected classes include SQL injection, cross-site scripting, hardcoded secrets
and API keys, weak cryptography, command injection, and path traversal.

> **Current limitation.** Scanning is pattern-based only. The `--ai` flag and the
> `scanOnCommit` setting are not yet wired to the AI analysis path, so they
> currently have no effect. Pattern scanning works as documented.

## Troubleshooting

**"rejected your credentials"** — the key is missing, expired, or lacks access.
Check `wush providers` to see which key wush is actually picking up.

**"is not logged in"** — a subscription provider whose CLI is installed but not
authenticated. Run `claude login` or `codex login`.

**"support is not installed"** — the optional subscription provider package is
missing, or you are on Node 18. `wush providers` shows which CLIs it can find.

**"does not recognise the selected model"** — the model id is stale. Run
`wush models -r` and pick again.

**"Could not reach ..."** — for local endpoints, confirm the server is running
(`ollama serve`). For remote ones, check the base URL.

**"produced a response that did not match the expected format"** — usually a
small local model failing at structured output. Try a larger one.

**"rejected the output schema wush sent"** — a bug in wush rather than your
setup. Please open an issue including the provider and model id.

## Development

```bash
git clone https://github.com/bikidsx/wush.git
cd wush
bun install

bun run dev commit     # run from source
bun run type-check     # tsc over src and tests
bun test               # test suite
bun run build          # bundle to dist/
bun run verify         # type-check + test + build
```

### Layout

```
src/
  commands/          one file per CLI command
  services/
    ai/
      registry.ts    providers as data — add one here and it just works
      model.ts       config + credentials -> a model handle
      models.ts      runtime model discovery and caching
      modelFilter.ts capability, recency and deprecation classification
      tasks.ts       the four AI operations
      schemas.ts     validated output shapes
      errors.ts      provider failures -> actionable messages
    security/        pattern-based vulnerability scanning
    git.ts           git operations
  tui/               streaming terminal interface
  utils/             config and shared setup flows
```

Adding a provider means adding one entry to `BUILTIN_PROVIDERS` in
`registry.ts`. There is no factory to extend, no type union to widen, and no
menu to update.

## License

MIT © [bikidsx](https://github.com/bikidsx)
