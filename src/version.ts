/**
 * The CLI version.
 *
 * Kept as a constant rather than importing package.json, which sits outside
 * `rootDir` and would break the declaration build. `tests/version.test.ts`
 * asserts this stays in step with package.json, since the two had already
 * drifted (package.json 1.0.5 vs a hardcoded 1.0.0 in the CLI).
 */
export const VERSION = '2.0.5';
