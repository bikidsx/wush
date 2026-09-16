/**
 * Regression guard for OpenAI strict structured outputs.
 *
 * A live `wush commit` against gpt-5.4-mini failed with:
 *
 *   Invalid schema for response_format 'response': In context=(), 'required' is
 *   required to be supplied and to be an array including every key in
 *   properties. Missing 'scope'.
 *
 * OpenAI strict mode (on by default) forbids optional properties. The provider
 * docs are explicit: change `.nullish()` and `.optional()` to `.nullable()`.
 *
 * These tests assert the property at the schema level so the failure cannot
 * silently return — it would otherwise only reappear as a 400 at runtime,
 * against one provider, after a user had already staged their changes.
 */

import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import {
  branchNameSchema,
  commitMessageSchema,
  prDescriptionSchema,
  securityFindingsSchema,
} from '../src/services/ai/schemas.js';

type JsonSchemaNode = {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  anyOf?: JsonSchemaNode[];
};

/**
 * Walks every object node in a JSON schema and asserts `required` lists all of
 * its properties, which is precisely what OpenAI strict mode enforces.
 */
function assertAllPropertiesRequired(node: JsonSchemaNode, path = 'root'): void {
  if (node.properties) {
    const properties = Object.keys(node.properties);
    const required = node.required ?? [];

    for (const key of properties) {
      expect(required).toContain(key);
    }
    expect(required.length).toBe(properties.length);

    for (const [key, child] of Object.entries(node.properties)) {
      assertAllPropertiesRequired(child, `${path}.${key}`);
    }
  }

  if (node.items) assertAllPropertiesRequired(node.items, `${path}[]`);
  for (const branch of node.anyOf ?? []) assertAllPropertiesRequired(branch, path);
}

const SCHEMAS = {
  commitMessage: commitMessageSchema,
  prDescription: prDescriptionSchema,
  branchName: branchNameSchema,
  securityFindings: securityFindingsSchema,
};

describe('OpenAI strict structured output compatibility', () => {
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    test(`${name} marks every property as required`, () => {
      const jsonSchema = z.toJSONSchema(schema, { io: 'output' }) as JsonSchemaNode;
      assertAllPropertiesRequired(jsonSchema);
    });
  }

  test('nullable fields accept null rather than being absent', () => {
    // How a model actually answers when there is no scope or body.
    const parsed = commitMessageSchema.safeParse({
      type: 'chore',
      scope: null,
      subject: 'bump dependencies',
      body: null,
    });

    expect(parsed.success).toBe(true);
  });

  test('commit message rejects a missing nullable key', () => {
    // Strict mode means the key must be present, even if null.
    const parsed = commitMessageSchema.safeParse({
      type: 'chore',
      subject: 'bump dependencies',
    });

    expect(parsed.success).toBe(false);
  });

  test('security findings allow a null line number', () => {
    const parsed = securityFindingsSchema.safeParse({
      findings: [
        {
          severity: 'HIGH',
          type: 'SQL Injection',
          line: null,
          description: 'Concatenated query',
          fix: 'Use parameterised queries',
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });
});
