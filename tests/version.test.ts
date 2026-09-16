import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSION } from '../src/version.js';

describe('version', () => {
  test('matches package.json', () => {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf-8')
    ) as { version: string };

    expect(VERSION).toBe(pkg.version);
  });

  test('is a valid semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
