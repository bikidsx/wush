/**
 * Error presentation bound to the active provider.
 *
 * Commands do not know which provider produced a failure, but the message a
 * user needs depends on it: an API-key provider should point at `wush config`,
 * while a subscription provider must point at the vendor CLI's own login.
 */

import { toFriendlyError, type FriendlyError } from './errors.js';
import { availableProviders, describeSelection } from './model.js';
import { getConfig } from '../../utils/config.js';

/** Maps an error using the active provider for context. */
export function friendlyError(error: unknown, providerId?: string): FriendlyError {
  const config = getConfig();
  const id = providerId ?? describeSelection({}, config).providerId;
  const definition = availableProviders(config).find((p) => p.id === id);

  return toFriendlyError(error, {
    providerLabel: definition?.label,
    // e.g. `claude login` / `codex login`
    loginCommand: definition?.requiresCli ? `${definition.requiresCli} login` : undefined,
  });
}
