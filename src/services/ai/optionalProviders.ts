/**
 * Loaders for the optional subscription providers.
 *
 * `ai-sdk-provider-claude-code` and `ai-sdk-provider-codex-cli` are
 * `optionalDependencies`: they require Node >= 22 and the vendor CLI, and most
 * users authenticate with a plain API key instead. They are therefore imported
 * dynamically, and a missing install must produce an instruction rather than a
 * module-resolution stack trace.
 *
 * Both delegate to the vendor's own already-authenticated CLI. wush never sees,
 * stores, or transmits a subscription token — the credentials stay in the
 * vendor's credential store, which is also why this is the supported route
 * rather than reimplementing their OAuth flows.
 */

export class OptionalProviderError extends Error {
  constructor(
    message: string,
    readonly hint: string
  ) {
    super(message);
    this.name = 'OptionalProviderError';
  }
}

/** Minimum Node version required by both subscription providers. */
const REQUIRED_NODE_MAJOR = 22;

function assertNodeVersion(label: string): void {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);

  if (Number.isFinite(major) && major < REQUIRED_NODE_MAJOR) {
    throw new OptionalProviderError(
      `${label} requires Node.js ${REQUIRED_NODE_MAJOR} or newer.`,
      `You are running Node ${process.versions.node}. Upgrade Node, or use an API-key provider instead.`
    );
  }
}

async function loadOptional<T>(
  packageName: string,
  label: string,
  cliHint: string,
  load: () => Promise<T>
): Promise<T> {
  assertNodeVersion(label);

  try {
    return await load();
  } catch (error) {
    const code = (error as { code?: string } | undefined)?.code;

    // A genuinely absent optional dependency, as opposed to a broken import.
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
      throw new OptionalProviderError(
        `${label} support is not installed.`,
        `Install it with \`npm install -g ${packageName}\`, then ${cliHint}`
      );
    }
    throw error;
  }
}

export function loadClaudeCodeProvider() {
  return loadOptional(
    'ai-sdk-provider-claude-code',
    'Claude subscription (Claude Code)',
    'make sure `claude` is installed and you have run `claude login`.',
    () => import('ai-sdk-provider-claude-code')
  );
}

export function loadCodexCliProvider() {
  return loadOptional(
    'ai-sdk-provider-codex-cli',
    'ChatGPT subscription (Codex CLI)',
    'make sure `codex` is installed and you have signed in with `codex login`.',
    () => import('ai-sdk-provider-codex-cli')
  );
}
